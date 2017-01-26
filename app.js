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

// making a charge

app.post("/thanks", (req, res) => {
  // log form response
  console.log(req.body);
  // 400 represents the additional shipping charge 
  let amount = req.body.stripeAmount * 100 + 400;
  // resolve shipping preference
  var shipping_recipient = "";
  if (req.body.shipping_preference == "customer") {
    shipping_recipient = req.body.customer_name;
    shipping_preference = "Ship to customer";
  }
  if (req.body.shipping_preference == "recipient") {
    shipping_recipient = req.body.recipient_name;
    shipping_preference = "Ship to recipient";
  }
  if (req.body.shipping_preference == "pickup") {
    shipping_recipient = "DO NOT SHIP";
    shipping_preference = "Pick up at office";
  }
  // custom message
  if (req.body.recipient_message) {
    recipient_message = req.body.recipient_message;
  }
  else {
    recipient_message = "";
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
          description: "this is a dumb description",
          amount: 999,
          currency: "usd",
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
        giftcard_amount: req.body.stripeAmount,
        delivery_method: shipping_preference,
        customer_name: req.body.customer_name,
        customer_phone: req.body.customer_phone,
        recipient_name: req.body.recipient_name,
        recipient_message: recipient_message
      }
    }))
  .then(charge => res.render("thanks.ejs"));
});

// render the app

app.get("/", (req, res) =>
  res.render("index.ejs", {keyPublishable}));
  console.log('Listening at http://localhost:7000/')

app.listen(process.env.PORT || 7000);

