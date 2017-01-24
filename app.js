// PUBLISHABLE_KEY=pk_test_Gbu2akKhNgGjbKi4LPxOOWqc 
// SECRET_KEY=sk_test_7ldA4yzhiJePJQp1yMk0oKjw node app.js

// const keyPublishable = process.env.PUBLISHABLE_KEY;
// const keySecret = process.env.SECRET_KEY;

const keyPublishable = "pk_test_Gbu2akKhNgGjbKi4LPxOOWqc";
const keySecret = "sk_test_7ldA4yzhiJePJQp1yMk0oKjw";
const express = require('express')
const app = express()
const stripe = require("stripe")(keySecret);
const bodyParser = require('body-parser')
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');

// making a charge

app.post("/thanks", (req, res) => {
  // resolve amount
  console.log(req.body);
  let amount = req.body.stripeAmount * 100;
  // resolve shipping preference
  var shipping_preference = req.body.shipping_preference;
  var shipping_recipient = "";
  if (shipping_preference == "customer") {
    shipping_recipient = req.body.customer_name
  }
  if (shipping_preference == "recipient") {
    shipping_recipient = req.body.recipient_name
  }
  if (shipping_preference == "pickup") {
    shipping_recipient = "DO NOT SHIP"
  }
  // make a new customer
  stripe.customers.create({
    email: req.body.stripeEmail,
    source: req.body.stripeToken,
    metadata: {
      customer_phone: req.body.customer_phone
    }
  })
  // charge them
  .then(customer =>
    stripe.charges.create({
      amount,
      currency: "usd",
      customer: customer.id
    }))
  // order the product
  .then(customer =>
    stripe.orders.create({
      email: req.body.stripeEmail,
      currency: "usd",
      items: [
        {
          parent: "sku_9zNqpcc7vUcgNv",
        }
      ],
      shipping: {
        name: shipping_recipient,
        address: {
          line1: req.body.shipping_address_line1,
          line2: req.body.shipping_address_line2,
          city: req.body.shipping_address_city,
          state: req.body.shipping_address_state,
          country: req.body.shipping_address_country,
          postal_code: req.body.shipping_address_postal_code
        }
      },
      metadata: {
        recipient_name: req.body.recipient_name
      }
    }))
  .then(charge => res.render("thanks.ejs"));
});

// render the app

app.get("/", (req, res) =>
  res.render("index.ejs", {keyPublishable}));
  console.log('Listening at http://localhost:7000/')

app.listen(process.env.PORT || 7000);

