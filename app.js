// Dependencies

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

// Initialize

app.get("/", (req, res) =>
  res.render("index.ejs", {keyPublishable}));
  console.log('Listening at http://localhost:7000/')

// Form submission

function getSku(form) {
  console.log(form);
  var newSku;
  stripe.skus.list({
    limit: 30
  }, function(err, skus) {
    if (err) {
      console.log(err)
    }
    var sortedskus = _.map(skus.data, "price")
    if (sortedskus.includes(form.stripeAmount * 100)) {
      existingSku = _.filter(skus.data, {
        'price': form.stripeAmount * 100
      });
      //console.log("This price already exists for the amout $" + form.stripeAmount + ", using sku: " + newSku);
      completeOrder(form, existingSku[0].id);
    } else {
      stripe.skus.create({
        product: form.productId,
        attributes: {
          'loadedamount': form.stripeAmount
        },
        price: form.stripeAmount * 100,
        currency: 'usd',
        inventory: {
          type: 'infinite'
        }
      }, function(err, sku) {
        if (err) {
          console.log(err)
        }
        //console.log("$" + form.stripeAmount + " is a new price. We made a new sku: " + sku.id);
        completeOrder(form, sku.id);
      })
    }
  })
}

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

function completeOrder(form, sku) {
  //console.log("!!!!!! 1. SKU CONFIRMED !!!!!!");
  var customerId;
  var orderTotal = form.stripeAmount * 100;
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
    //console.log("!!!!!! 2. CUSTOMER CREATED !!!!!!");
    customerId = customer.id;
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
      // Determining if we need to charge for shipping
      var isFreeShipping;
      if (form.shipping_preference == "pickup") {
        isFreeShipping = true;
      } else {
        isFreeShipping = false;
      }
      // Updating shipping
      if (isFreeShipping) {
        console.log("SHIPPING: FREE");
        function getFreeMethodId(method) {
          return method.amount === 0;
        }
        var shippingId = order.shipping_methods.find(getFreeMethodId).id;
        orderTotal += order.shipping_methods.find(getFreeMethodId).amount;
      } else {
        console.log("SHIPPING: NOT FREE");
        function getNotFreeMethodId(method) {
          return method.amount === 400;
        }
        var shippingId = order.shipping_methods.find(getNotFreeMethodId).id;
        orderTotal += order.shipping_methods.find(getNotFreeMethodId).amount;
      }
      stripe.orders.update(order.id, {
        selected_shipping_method: shippingId
      });
      stripe.charges.create({
        amount: orderTotal,
        currency: "usd",
        customer: customerId
      }, function(err, charge) {
        if (err) {
          console.log(err)
        }
      });
    });
  });
}

app.post('/thanks', function (req, res) {
  getSku(req.body);
  res.render("thanks.ejs")
})

// Listening

app.listen(process.env.PORT || 7000);
