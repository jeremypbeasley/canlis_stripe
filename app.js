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

// Stripe requires a very particular order of functions here.
// 1. Create a new customer.
// 2. You must evaluate a sku for a product. Unfortunately, Stripe does not support a variable price on a product. The only way to do this is to create multiple skus of one product, each with their own price. You can create a sku at the time of purchase but since the only attribute of the sku is price, you'll get an error back if you try to make a new sku for a price that's already been created by another customer.
// 3. You must query the existing skus to see if ones already exists with the price your customer has entered. If there is not, you proceed with a new sku. If there is, you must use that existing sku.
// 4. Create an order for said sku.
// 5. Create a charge.

function evaluateSku(form) {
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
      newSku = existingSku[0].id;
      console.log("This price already exists for the price: $" + form.stripeAmount + ", using sku: " + newSku);
      completeOrder(form, newSku);
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
        newSku = sku.id;
        console.log("$" + form.stripeAmount + " is a new price. We made a new sku: " + sku.id);
        completeOrder(form, newSku);
      })
    }
  })
}

function completeOrder(form, sku) {
  var customerId;
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
    //console.log("!!!!!! 1. CUSTOMER CREATED !!!!!!");
    customerId = customer.id;
    stripe.orders.create({
      items: [{
        parent: sku
      }],
      currency: "usd",
      email: form.stripeEmail,
    }, function(err, order) {
      if (err) {
        console.log(err)
      }
      //console.log("!!!!!! 2. ORDER CREATED !!!!!!");
      stripe.charges.create({
        amount: form.stripeAmount * 100,
        currency: "usd",
        customer: customerId
      }, function(err, charge) {
        if (err) {
          console.log(err)
        }
        //console.log("!!!!!! 3. CHARGE CREATED !!!!!!");
      });
    });
  });
}

app.post('/thanks', function (req, res) {
  evaluateSku(req.body, res);
  res.render("thanks.ejs")
})

// Listening

app.listen(process.env.PORT || 7000);
