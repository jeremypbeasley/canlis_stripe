// Declare dependencies

require('dotenv').config()
const keyPublishable = process.env.keyPublishable;
const keySecret = process.env.keySecret;
const express = require('express')
const app = express()
const stripe = require("stripe")(keySecret);
stripe.setApiVersion('2017-02-14');
const bodyParser = require('body-parser')
const _ = require("lodash");
const getJSON = require('get-json');
// const request = require('request');
const request = require('superagent');
const nodemailer = require('nodemailer');

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Initialize the app

app.get("/", (req, res) =>
  res.render("index.ejs", {keyPublishable}));
  console.log('Listening at http://localhost:7000/')

// Functions to perform transaction with Stripe
function buyGiftCard(form, callback) {
  //console.log(form);
  getSkuList((err, skuList) => {
    if (err) {}
    chooseSku(form, skuList, (err, chosenSku) => {
      if (err) {}
      createCustomer(form, (err, customer) => {
        if (err) {}
        createOrder(form, chosenSku, (err, order) => {
          if (err) {}
          applyShipping(form, order, (err, orderTotal) => {
            if (err) {}
            createCharge(customer, orderTotal, (err, chargedeets) => {
              if (err) {}
              callback(null, chargedeets);
              mailchimpAddSub(order.email);
              sendReceipt(order);
            });
          });
        });
      });
    });
  });
}

function getSkuList(callback) {
  stripe.skus.list({
    limit: 30
  }, function(err, skus) {
      if (err) {}
      callback(null, skus);
    }
  )
}

function chooseSku(form, skuList, callback) {
  // make a list of price-points that already exist for the gift card
  var sortedskus = _.map(skuList.data, "price")
  // see if the price we're trying to submit already exists
  if (sortedskus.includes(form.stripeAmount * 100)) {
    existingSku = _.filter(skuList.data, {
      // since the form is submitting an integer, we must make it make "cents"
      'price': form.stripeAmount * 100
    });
    // use the existing sku
    callback(null, existingSku[0].id);
  } else {
    // make a new sku
    stripe.skus.create({
      product: form.productId,
      attributes: {
        'loadedamount': form.stripeAmount
      },
      // since the form is submitting an integer, we must make it make "cents"
      price: form.stripeAmount * 100,
      currency: 'usd',
      inventory: {
        type: 'infinite'
      }
    }, function(err, newSku) {
      if (err) {
        console.log(err);
      }
      // use new sku
      callback(null, newSku.id);
    });
  }
}

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
var recipient_message;
  if (!form.recipient_message) {
    recipient_message = "No message provided.";
  } else {
    recipient_message = form.recipient_message;
  }
  stripe.orders.create({
    items: [{
      type: 'sku',
      parent: chosenSku
    }],
    currency: "usd",
    email: form.stripeEmail,
    shipping: {
      name: form.recipient_name,
      address: {
        line1: form.shipping_address_line1,
        city: form.shipping_address_city,
        state: form.shipping_address_state,
        postal_code: form.shipping_address_postal_code
      }
    },
    // we throw in some information as meta data so it can easily be seen from the Stripe dashboard at https://dashboard.stripe.com/orders without clicking on the customer
    metadata: {
      giftcard_amount: '$' + form.stripeAmount,
      customer_name: form.customer_name,
      customer_email: form.stripeEmail,
      customer_phone: form.customer_phone,
      recipient_name: form.recipient_name,
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
  // get the ids for free and standard shipping from the order object
  if (isFreeShipping) {
    function getFreeMethodId(method) {
      return method.amount === 0;
    }
    var shippingId = order.shipping_methods.find(getFreeMethodId).id;
    orderTotal += order.shipping_methods.find(getFreeMethodId).amount;
  } else {
    function getNotFreeMethodId(method) {
      return method.amount === 400;
    }
    var shippingId = order.shipping_methods.find(getNotFreeMethodId).id;
    orderTotal += order.shipping_methods.find(getNotFreeMethodId).amount;
  }
  // update the order object with the prefered shipping method
  stripe.orders.update(order.id, {
    selected_shipping_method: shippingId
  });
  callback(null, orderTotal)
}

function createCharge(customer, orderTotal, callback) {
  stripe.charges.create({
    amount: orderTotal,
    currency: "usd",
    customer: customer.id
  }, function(err, charge) {
    if (err) {
      console.log(err)
    }
    callback(null, charge)
  })
}

// Add to Mailchimp

function mailchimpAddSub(email) {
  request
    .post('https://' + process.env.mailchimpDataCenter + '.api.mailchimp.com/3.0/lists/' + process.env.mailchimpListId + '/members')
    .set('Content-Type', 'application/json;charset=utf-8')
    .set('Authorization', 'Basic ' + new Buffer('any:' + process.env.mailchimpApiKey ).toString('base64'))
    .send({
      'email_address': email,
      'status': 'subscribed'
    })
    .end(function(err, response) {
      if (response.status < 300 || (response.status === 400 && response.body.title === "Member Exists")) {
        console.log('Signed Up!');
      } else {
        console.log('Sign Up Failed :(');
      }
    });
};

// Send a receipt

let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.googleAppsUsername,
        pass: process.env.googleAppsPassword
    }
});

// setup email data with unicode symbols
function sendReceipt(data) {
  let html = [
    // '<div>',
    // '<p>Your ' + data.metadata.giftcard_amount + ' gift card from Canlis has been orded.</p>',
    // '<p>It will be shipped to the address you provided' + data.metadata.giftcard_amount + ' gift card from Canlis has been orded.</p>',
    // '</div>'
    '<head>',
      '<meta content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" name="viewport">',
    '</head>',
    '<div class="EmailContainer" style="font-family: &quot;Courier New&quot;, Courier, monospace;font-size: 13px;color: black;background: white;line-height: 150%;max-width: 400px;margin: 30px 0px 60px 0px;">',
      '<hr style="width: 100%;height: 1px;border: none;border-bottom: 1px dashed black;background: transparent;margin: 32px 0px;">',
      '<img class="Logo" src="https://cdn2.dropmarkusercontent.com/39456/a4c04c2d4c01cd3377567b5feba635eda5b2917a/canlislogo.jpg" style="width: 100px;margin: 60px 0px;">',
      '<p>Hello,'
        var.name,
      '.</p>',
      '<p>Thanks for purchasing a gift card with us. We&#39;ll be shipping it in 1-2 business days.</p>',
      '<p>Confirmation No. #',
        var.id,
      '</p>',
      '<hr style="width: 100%;height: 1px;border: none;border-bottom: 1px dashed black;background: transparent;margin: 32px 0px;">',
      '<table style="width: 100%;margin: 0px;padding: 0px;border-spacing: 0px;font-family: &quot;Courier New&quot;, Courier, monospace;font-size: 13px;color: black;">',
        '<tbody>',
          '<tr style="margin: 0px;padding: 0px;border: none;font-family: &quot;Courier New&quot;, Courier, monospace;font-size: 13px;">',
            '<td style="margin: 0px;padding: 0px;border: none;font-family: &quot;Courier New&quot;, Courier, monospace;font-size: 13px;">',
              '<span style="display: block;padding: .5em 0px;">',
                'Gift Card Amount',
              '</span>',
            '</td>',
            '<td class="Currency" style="margin: 0px;padding: 0px;border: none;font-family: &quot;Courier New&quot;, Courier, monospace;font-size: 13px;text-align: right;">',
              '<span style="display: block;padding: .5em 0px;">',
                var.giftcardamount,
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
              '<span style="display: block;padding: .5em 0px;">',
                var.shippingcost,
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
              '<span style="display: block;padding: .5em 0px;">',
                var.total,
              '</span>',
            '</td>',
          '</tr>',
        '</tbody>',
      '</table>',
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
                var.name,
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
                '<a href="mailto:kelly.mercer@gmail.com" style="color: black;text-decoration: none;">',
                  var.email,
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
                  var.date,
                '</a>',
              '</span>',
            '</td>',
          '</tr>',
        '</tbody>',
      '</table>',
      '<p>',
        'Shipping Address:<br>',
        '<a href=" style="color: black;text-decoration: none;">',
          var.shippingline1, '<br>',
          var.city, '&#44; ', var.state, '<br>',
          var.zip, '</a>',
      '</p>',
      '<hr style="width: 100%;height: 1px;border: none;border-bottom: 1px dashed black;background: transparent;margin: 32px 0px;">',
      '<p>If you have any questions about your card, please call us at <a href="tel:2062833313" style="color: black;text-decoration: none;">(206) 283-3313</a></p>',
    '</div>',
  ].join('\n');
  let mailOptions = {
      from: '"Canlis" <no-reply@canlis.com>', // sender address
      to: data.email, // list of receivers
      subject: 'Your gift card receipt from Canlis.', // Subject line
      text: 'Hello world ?', // plain text body
      html: html // html body
  };
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        return console.log(error);
    }
    console.log('Message %s sent: %s', info.messageId, info.response);
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
