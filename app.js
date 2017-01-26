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
  // converts to whole number
  let amount = req.body.stripeAmount * 100;
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
    stripe.skus.create({
      product: 'prod_A06J6m2sZjfgXq',
      attributes: {'loadedamount': req.body.stripeAmount},
      price: amount,
      currency: 'usd',
      inventory: {'type': 'infinite'},
      // unclear how to pass this down besides hiding in this pair
      image: customer.id
    }
  ))
  .then(sku =>
    stripe.orders.create({
      email: req.body.stripeEmail,
      // how to add charge here when it's not been created
      //charge: charge.id,
      customer: sku.image,
      currency: "usd",
      items: [
        {
          description: "this is a dumb description",
          amount: amount,
          currency: "usd",
          parent: sku.id
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
        customer_email: req.body.stripeEmail,
        recipient_name: req.body.recipient_name,
        recipient_message: recipient_message
      }
    }
  ))
  .then(order =>
    stripe.charges.create({
      amount: order.amount,
      currency: "usd",
      customer: order.customer,
      description: "gift card purchase",
      metadata: {
        delivery_method: shipping_preference,
        customer_name: req.body.customer_name,
        customer_phone: req.body.customer_phone,
        recipient_name: req.body.recipient_name,
        recipient_message: recipient_message,
        shipping_address_1: req.body.shipping_address_line1,
        shipping_address_2: req.body.shipping_address_line2,
        shipping_address_3: req.body.shipping_address_city,
        shipping_address_4: req.body.shipping_address_state,
        shipping_address_5: req.body.shipping_address_country,
        shipping_address_6: req.body.shipping_address_postal_code
      }
    }
  ))
  .then(charge => res.render("thanks.ejs"));
});

// render the app

app.get("/", (req, res) =>
  res.render("index.ejs", {keyPublishable}));
  console.log('Listening at http://localhost:7000/')

app.listen(process.env.PORT || 7000);

