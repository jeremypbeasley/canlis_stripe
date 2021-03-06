// Environment
require('dotenv').config();

// Stripe
const keyPublishable = process.env.keyPublishable;
const keySecret = process.env.keySecret;
const productId = process.env.productId;
const stripe = require("stripe")(keySecret, {apiVersion:'2020-03-02'});

// Tools
const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const _ = require("lodash");
const getJSON = require('get-json');
const request = require('superagent');
const nodemailer = require('nodemailer');
const moment = require('moment');

// Settings
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Initialize the app
app.get("/", (req, res) =>
  res.render("index.ejs", {keyPublishable}));
  console.log('Listening at http://localhost:7000/')

// todo: write in plain english what is happening here

// Functions to perform transaction with Stripe
function buyGiftCard(form, callback) {
  getSkuList((err, skuList) => {
    if (err) {
      console.log("FAIL: getSkuList ", err )
    }
    chooseSku(form, skuList, (err, chosenSku) => {
      if (err) {
        console.log("FAIL: chooseSku ", err )
      }
      createOrder(form, chosenSku, (err, order) => {
        if (err) {
          console.log("FAIL: createOrder ", err )
        }
        // console.log(order);
        applyShipping(form, order, (err, orderTotal) => {
          if (err) {
            console.log("FAIL: applyShipping ", err )
          }
          payOrder(order, form, (err, order) => {
            if (err) {
              console.log("FAIL: payOrder ", err )
            }
            callback(null, order);
            sendReceipt(order, order);
          });
        });
      });
    });
  });
}

// Note: A gift card is a "product" in Stripe. Stripe makes a new "sku" every
// time a gift card is purchased with a new price. We have to check and see if
// there is already a sku for the price the user has entered in the form. If so,
// we use that existing sku. If not, we make a new one.

// Loop through skus, given Stripe only returns up to 100
async function getSkus(starting_after = null, result = []) {
  const options = {
    limit: 100,
  }
  if (starting_after) options.starting_after = starting_after
  const skus = await stripe.skus.list(options);
  result.push(skus)
  if(skus.length === 100) {
    return getSkus(skus[skus.length-1].data.id, result);
  }
  return result
}

// Get skus for existing products (looking for the gift card sku)
async function getSkuList(callback) {
  let skus = await getSkus();
  // console.log(skus)
  callback(null, skus)
}

// Choose a sku from the list or make a new one
function chooseSku(form, skuList, callback) {
  // Make a list of price-points that already exist for the gift card
  var sortedskus = _.map(skuList.data, "price")
  // See if the price we're trying to submit already exists
  if (sortedskus.includes(form.stripeAmount * 100)) {
    existingSku = _.filter(skuList.data, {
      // Since the form is submitting an integer, we must make it make "cents"
      'price': form.stripeAmount * 100
    });
    // Use the existing sku
    callback(null, existingSku[0].id);
  } else {
    // Make a new sku
    stripe.skus.create({
      product: productId,
      attributes: {
        'loadedamount': form.stripeAmount
      },
      // Since the form is submitting an integer, we must make it make "cents"
      price: form.stripeAmount * 100,
      currency: 'usd',
      inventory: {
        type: 'infinite'
      }
    }, function(err, newSku) {
      if (err) {
        console.log(err);
      }
      // Use the new sku
      callback(null, newSku.id);
    });
  }
}

// Stripe requires the creation of a "customer" to apply an "order".
// Docs here: https://stripe.com/docs/api/customers/create
function createCustomer(form, callback) {
  stripe.customers.create({
    email: form.stripeEmail,
    source: form.stripeToken,
    metadata: {
      customer_phone: form.customer_phone
    }
  }, function(err, customer) {
    if (err) {
      console.log(err)
    }
    callback(null, customer);
  })
}

function createOrder(form, chosenSku, callback) {
  // Fallback for optional message
  var recipient_message;
  if (!form.recipient_message) {
    recipient_message = "No message provided.";
  } else {
    recipient_message = form.recipient_message;
  }
  // Fallback for optional from name
  var fromname;
  if (!form.from_name) {
    fromname = "None provided"
  } else {
    fromname = form.from_name;
  }
  // Fallback for optional second address line
  var addressline2;
  if (!form.shipping_address_line2) {
    // Add empty string
    addressline2 = "";
  } else {
    addressline2 = form.shipping_address_line2;
  }
  stripe.orders.create({
    items: [{
      type: 'sku',
      parent: chosenSku
    }],
    currency: "usd",
    email: form.stripeEmail,
    shipping: {
      name: form.shipping_address_name,
      address: {
        line1: form.shipping_address_line1,
        line2: addressline2,
        city: form.shipping_address_city,
        state: form.shipping_address_state,
        postal_code: form.shipping_address_postal_code
      }
    },
    // We throw in some information as meta data so it can easily be seen from the Stripe dashboard at https://dashboard.stripe.com/orders without clicking on the customer
    metadata: {
      card_id: "Not assigned yet",
      shipping_preference: form.shipping_preference,
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      from: fromname,
      to: form.recipient_name,
      recipient_message: recipient_message
    }
  }, function(err, order) {
    if (err) {
      console.log(err)
    }
    callback(null, order);
  })
}

function applyShipping(form, order, callback) {
  var isFreeShipping;
  var orderTotal = form.stripeAmount * 100;
  if (form.shipping_preference == "pickup") {
    isFreeShipping = true;
  } else {
    isFreeShipping = false;
  }
  // Get the ids for free and standard shipping from the order object
  if (isFreeShipping) {
    function getFreeMethodId(method) {
      // todo: change to search by description not amount
      return method.amount === 0;
    }
    var shippingId = order.shipping_methods.find(getFreeMethodId).id;
    orderTotal += order.shipping_methods.find(getFreeMethodId).amount;
  } else {
    function getNotFreeMethodId(method) {
      // todo: change to search by description not amount
      return method.amount === 500;
    }
    var shippingId = order.shipping_methods.find(getNotFreeMethodId).id;
    orderTotal += order.shipping_methods.find(getNotFreeMethodId).amount;
  }
  // update the order object with the prefered shipping method
  stripe.orders.update(order.id, {
    selected_shipping_method: shippingId
  }, function(err, order) {
    if (err) {
      console.log(err)
    }
    callback(null, orderTotal)
  });
}

function payOrder(order, form, callback) {
  stripe.orders.pay(order.id, {
    source: form.stripeToken
  }, function(err, order) {
    if (err) {
      console.log(err)
    }
    callback(null, order)
  });
}


// Send a receipt
let transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.googleAppsUsername,
    pass: process.env.googleAppsPassword
  }
});

// Setup email data
function sendReceipt(order, charge) {
  var date = new Date("January 25, 2015");
  var charge_amount = (order.items[0].amount / 100).toFixed(2);
  var charge_shipping = ( function() {
    if (order.metadata.shipping_preference !== "pickup") {
      return '5.00';
    } else {
      return '0.00';
    }
  }) ();
  var charge_total = (charge.amount / 100).toFixed(2);
  var date = moment(Date.now()).format('MMMM Do YYYY, h:mm:ss a');
  var address_link = ( function() {
    if (order.shipping.address.line2 !== null) {
      return 'https://www.google.com/maps/place/' + order.shipping.address.line1 + '+' + order.shipping.address.line2 + '+' + order.shipping.address.city + '+' + order.shipping.address.state + '+' + order.shipping.address.postal_code;
    } else {
      return 'https://www.google.com/maps/place/' + order.shipping.address.line1 + '+' + order.shipping.address.city + '+' + order.shipping.address.state + '+' + order.shipping.address.postal_code;
    }
  }) ();
  var shipping_greeting = ( function() {
    if (order.metadata.shipping_preference == "pickup") {
      return 'We&#39;ll have it ready for you in 1-2 business days. <br><br>Feel free to call us at <a href="tel:2062833313" style="color: black;text-decoration: none;">(206) 283-3313</a> to confirm it&apos;s ready before you visit our office. <br><br> Need directions to our office? Click <a href="https://www.google.com/maps/place/Canlis/@47.6430933,-122.3467535,15z" target="_blank">here</a>.';
    }
    if (order.metadata.shipping_preference == "customer") {
      return 'We&#39;ll be shipping it to you in 1-2 business days.';
    }
    if (order.metadata.shipping_preference == "recipient") {
      return 'We&#39;ll be shipping it out in 1-2 business days.';
    }
  }) ();
  let shippingContent = [
    '<p>',
      'Shipping To:<br>',
      '<a href="', address_link, '" style="color: black;text-decoration: none;">',
        order.shipping.name, '<br>',
        order.shipping.address.line1, '&nbsp;',
        order.shipping.address.line2, '<br>',
        order.shipping.address.city, '&#44; ', order.shipping.address.state, '<br>',
        order.shipping.address.postal_code, '</a>',
    '</p>',
  ].join('\n');
  var shipping_section = ( function() {
    if (order.metadata.shipping_preference !== "pickup") {
      return shippingContent;
    } else {
      return;
    }
  }) ();
  let html = [
    '<head>',
      '<meta content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" name="viewport">',
    '</head>',
    '<style> .im {color: #000000 !important;} </style>',
    '<div class="EmailContainer" style="font-family: &quot;Courier New&quot;, Courier, monospace;font-size: 13px;color: black;background: white;line-height: 150%;max-width: 400px;margin: 30px 0px 60px 0px;">',
      '<hr style="width: 100%;height: 1px;border: none;border-bottom: 1px dashed black;background: transparent;margin: 32px 0px;">',
      '<img class="Logo" src="https://cdn2.dropmarkusercontent.com/39456/a4c04c2d4c01cd3377567b5feba635eda5b2917a/canlislogo.jpg" style="width: 100px;margin: 60px 0px;">',
      '<p>Thanks for purchasing a gift card with us. ',
        shipping_greeting,
      '</p>',
      '<p>Order No. #', order.id, '</p>',
      '<hr style="width: 100%;height: 1px;border: none;border-bottom: 1px dashed black;background: transparent;margin: 32px 0px;">',
      '<table style="width: 100%;margin: 0px;padding: 0px;border-spacing: 0px;font-family: &quot;Courier New&quot;, Courier, monospace;font-size: 13px;color: black;">',
        '<tbody>',
          '<tr style="margin: 0px;padding: 0px;border: none;font-family: &quot;Courier New&quot;, Courier, monospace;font-size: 13px;">',
            '<td style="margin: 0px;padding: 0px;border: none;font-family: &quot;Courier New&quot;, Courier, monospace;font-size: 13px;">',
              '<span style="display: block;padding: .5em 0px;">',
                'Gift Card Amount:',
              '</span>',
            '</td>',
            '<td class="Currency" style="margin: 0px;padding: 0px;border: none;font-family: &quot;Courier New&quot;, Courier, monospace;font-size: 13px;text-align: right;">',
              '<span style="display: block;padding: .5em 0px;">$',
                charge_amount,
              '</span>',
            '</td>',
          '</tr>',
          '<tr style="margin: 0px;padding: 0px;border: none;font-family: &quot;Courier New&quot;, Courier, monospace;font-size: 13px;">',
            '<td style="margin: 0px;padding: 0px;border: none;font-family: &quot;Courier New&quot;, Courier, monospace;font-size: 13px;">',
              '<span style="display: block;padding: .5em 0px;">',
                'Shipping:',
              '</span>',
            '</td>',
            '<td class="Currency" style="margin: 0px;padding: 0px;border: none;font-family: &quot;Courier New&quot;, Courier, monospace;font-size: 13px;text-align: right;">',
              '<span style="display: block;padding: .5em 0px;">$',
                charge_shipping,
              '</span>',
            '</td>',
          '</tr>',
          '<tr style="margin: 0px;padding: 0px;border: none;font-family: &quot;Courier New&quot;, Courier, monospace;font-size: 13px;">',
            '<td style="margin: 0px;padding: 0px;border: none;font-family: &quot;Courier New&quot;, Courier, monospace;font-size: 13px;">',
              '<span style="display: block;padding: .5em 0px;">',
                'Total:',
              '</span>',
            '</td>',
            '<td class="Currency" style="margin: 0px;padding: 0px;border: none;font-family: &quot;Courier New&quot;, Courier, monospace;font-size: 13px;text-align: right;">',
              '<span style="display: block;padding: .5em 0px;">$',
                charge_total,
              '</span>',
            '</td>',
          '</tr>',
        '</tbody>',
      '</table>',
      // unable to display this without separate query given that order.pay does not return CC info
      // '<p>Paid via ', charge.source.brand, ' ending in ', charge.source.last4,'</p>',
      '<hr style="width: 100%;height: 1px;border: none;border-bottom: 1px dashed black;background: transparent;margin: 32px 0px;">',
      '<table style="width: 100%;margin: 0px;padding: 0px;border-spacing: 0px;font-family: &quot;Courier New&quot;, Courier, monospace;font-size: 13px;color: black;">',
        '<tbody>',
          '<tr style="margin: 0px;padding: 0px;border: none;font-family: &quot;Courier New&quot;, Courier, monospace;font-size: 13px;">',
            '<td style="margin: 0px;padding: 0px;border: none;font-family: &quot;Courier New&quot;, Courier, monospace;font-size: 13px;">',
              '<span style="display: block;padding: .5em 0px;">',
                'Name:',
              '</span>',
            '</td>',
            '<td class="Currency" style="margin: 0px;padding: 0px;border: none;font-family: &quot;Courier New&quot;, Courier, monospace;font-size: 13px;text-align: right;">',
              '<span style="display: block;padding: .5em 0px;">',
                order.metadata.customer_name,
              '</span>',
            '</td>',
          '</tr>',
          '<tr style="margin: 0px;padding: 0px;border: none;font-family: &quot;Courier New&quot;, Courier, monospace;font-size: 13px;">',
            '<td style="margin: 0px;padding: 0px;border: none;font-family: &quot;Courier New&quot;, Courier, monospace;font-size: 13px;">',
              '<span style="display: block;padding: .5em 0px;">',
                'Email:',
              '</span>',
            '</td>',
            '<td class="Currency" style="margin: 0px;padding: 0px;border: none;font-family: &quot;Courier New&quot;, Courier, monospace;font-size: 13px;text-align: right;">',
              '<span style="display: block;padding: .5em 0px;">',
                '<a href="mailto:', order.email, '" style="color: black;text-decoration: none;">',
                  order.email,
                '</a>',
              '</span>',
            '</td>',
          '</tr>',
          '<tr style="margin: 0px;padding: 0px;border: none;font-family: &quot;Courier New&quot;, Courier, monospace;font-size: 13px;">',
            '<td style="margin: 0px;padding: 0px;border: none;font-family: &quot;Courier New&quot;, Courier, monospace;font-size: 13px;">',
              '<span style="display: block;padding: .5em 0px;">',
                'Date:',
              '</span>',
            '</td>',
            '<td class="Currency" style="margin: 0px;padding: 0px;border: none;font-family: &quot;Courier New&quot;, Courier, monospace;font-size: 13px;text-align: right;">',
              '<span style="display: block;padding: .5em 0px;">',
                '<a href="" style="color: black;text-decoration: none;">',
                  date,
                '</a>',
              '</span>',
            '</td>',
          '</tr>',
        '</tbody>',
      '</table>',
      shipping_section,
      '<hr style="width: 100%;height: 1px;border: none;border-bottom: 1px dashed black;background: transparent;margin: 32px 0px;">',
      '<p>If you have any questions about your card, please call us at <a href="tel:2062833313" style="color: black;text-decoration: none;">(206) 283-3313</a>.</p>',
    '</div>',
  ].join('\n');
  let mailOptions = {
      from: '"Canlis" <no-reply@canlis.com>',
      to: order.email,
      subject: '✉️ Your gift card receipt from Canlis.',
      text: '',
      html: html
  };
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        return console.log(error);
    }
    // console.log('Email receipt %s sent: %s', info.messageId, info.response);
  });
};

// Form submission
app.post('/thanks', function (req, res) {
  buyGiftCard(req.body, (err, done) => {
    if (err) {}
    // console.log(done);
    res.render("thanks.ejs");
  });
})

// Listening
app.listen(process.env.PORT || 7000);
