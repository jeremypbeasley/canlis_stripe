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
