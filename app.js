// Declare dependencies

require('dotenv').config()
const keyPublishable = process.env.keyPublishable;
const keySecret = process.env.keySecret;
const express = require('express')
const app = express()
const stripe = require("stripe")(keySecret);
const bodyParser = require('body-parser')
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');
var _ = require("lodash");
var getJSON = require('get-json');

// Initialize the app

app.get("/", (req, res) =>
  res.render("index.ejs", {keyPublishable}));
  console.log('Listening at http://localhost:7000/')

// Submit the form

function getSku(form) {
  var newSku;
  // get all existing skus and list them out
  stripe.skus.list({
    limit: 30
  }, function(err, skus) {
    if (err) {
      console.log(err)
    }
    // make a list of price-points that already exist for the gift card
    var sortedskus = _.map(skus.data, "price")
    // see if the price we're trying to submit already exists
    if (sortedskus.includes(form.stripeAmount * 100)) {
      existingSku = _.filter(skus.data, {
        // since the form is submitting an integer, we must make it make "cents"
        'price': form.stripeAmount * 100
      });
      // use the existing sku
      completeOrder(form, existingSku[0].id);
    } else {
      // or if it doesn't, just make a new one
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
      }, function(err, sku) {
        if (err) {
          console.log(err)
        }
        //now you've got a sku, proceed to contruct the customer, order, and charge
        completeOrder(form, sku.id);
      })
    }
  })
}

function completeOrder(form, sku) {
  // so now we have a sku, let's define some global variables that we're going to update along the way
  var customerId;
  var orderTotal = form.stripeAmount * 100;
  // use the .customers method to make a new customer using the email and token, we also throw a phone number in there due to Canlis' needs
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
    // ok, customer created, let's save that id since we'll use it later
    customerId = customer.id;
    // now, construct the order
    stripe.orders.create({
      items: [{
        parent: sku
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
        recipient_message: form.recipient_message
      }
    }, function(err, order) {
      if (err) {
        console.log(err)
      }
      // now, determine if we need to charge them for shipping based on what they selected in the form
      var isFreeShipping;
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
      // now, we construct a charge
      stripe.charges.create({
        amount: orderTotal,
        currency: "usd",
        customer: customerId
      }, function(err, charge) {
        if (err) {
          console.log(err)
        }
        // ok, now everything's done. Form Success! Render thank you page.
        // TEST LOG
        // console.log("TOTAL CHARGE: $" + charge.amount / 100);
      });
    });
  });
}

// Update shipping in completeOrder

function updateShipping(orderId, methods, isFree) {
  if (isFree) {
    console.log("SHIPPING: FREE");
    function getFreeMethodId(method) {
      return method.amount === 0;
    }
    var shippingId = methods.find(getFreeMethodId).id;
  } else {
    console.log("SHIPPING: NOT FREE");
    function getNotFreeMethodId(method) {
      return method.amount === 400;
    }
    var shippingId = methods.find(getNotFreeMethodId).id;
  }
  stripe.orders.update(orderId, {
    selected_shipping_method: shippingId
  })
}

// Route for when the form is submitted

app.post('/thanks', function (req, res) {
  getSku(req.body);
  // rendering the thanks screen should not happen here, it should happen on 150 when the entire form is complete.
  res.render("thanks.ejs")
})

// Listening

app.listen(process.env.PORT || 7000);
