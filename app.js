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

// making a charge

app.post("/thanks", (req, res) => {
  // converts to whole number
  var amount = req.body.stripeAmount * 100;
  var newSku = "";
  var productId = "prod_A06J6m2sZjfgXq";
  var customerId = "";
  stripe.skus.list({ 
    limit: 30 
  })
  .then(
    function(skus) {
      console.log("first")
      var sortedskus = _.map(skus.data, "price")
      //console.log(sortedskus)
      if (sortedskus.includes(amount)) {
        existingSku = _.filter(skus.data, {'price': amount});
        newSku = existingSku[0].id;
        console.log("This price already exists, use sku: " + newSku);
      }
      else {
        stripe.skus.create({
          product: productId,
          attributes: {'loadedamount': req.body.stripeAmount},
          price: amount,
          currency: 'usd',
          inventory: {type: 'infinite'}
        }, 
          function(err, sku) {
            newSku = sku.id;
            console.log("This is a new price. We made a new sku " + sku.id);
          }
        )
      }
    }
  )
  .then(
    stripe.customers.create({
      email: req.body.stripeEmail,
      source: req.body.stripeToken
    }, 
      function(err, customer) {
        customerId = customer.id;
        console.log("customerId=" + customerId)
      }
    )
  )
  .then(
    stripe.orders.create({
      email: req.body.stripeEmail,
      customer: customerId,
      currency: "usd",
      items: [
        {
          amount: amount,
          currency: "usd",
          parent: newSku
        }
      ]
    })
  )
  .then(
    stripe.charges.create({
      amount: amount,
      currency: "usd",
      customer: customerId,
    })
  )
  .then(charge => res.render("thanks.ejs"));
});

// render the app

app.get("/", (req, res) =>
  res.render("index.ejs", {keyPublishable}));
  console.log('Listening at http://localhost:7000/')

app.listen(process.env.PORT || 7000);

