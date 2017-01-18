const keyPublishable = process.env.PUBLISHABLE_KEY;
const keySecret = process.env.SECRET_KEY;

const app = require("express")();
const stripe = require("stripe")(keySecret);

const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

app.set('view engine', 'ejs')

app.get("/", (req, res) =>
  res.render("index.ejs", {keyPublishable}));
  console.log('Listening at http://localhost:7000/')

app.post("/charge", (req, res) => {
  totalAmount = req.body.stripeAmount * 100;
  let amount = totalAmount;
  stripe.customers.create({
    email: req.body.stripeEmail,
    source: req.body.stripeToken,
  })
  .then(customer =>
    stripe.charges.create({
      amount,
      currency: "usd",
      customer: customer.id
    }))
  .then(customer =>
    stripe.orders.create({
      email: req.body.stripeEmail,
      currency: "usd",
      items: [
        {
          parent: "sku_9xArcudWoopYAB",
        }
      ],
      shipping: {
        name: req.body.shipping_name,
        address: {
          line1: req.body.shipping_address_line1,
          line2: req.body.shipping_address_line2,
          city: req.body.shipping_address_city,
          state: req.body.shipping_address_state,
          country: req.body.shipping_address_country,
          postal_code: req.body.shipping_address_postal_code
        }
      }
    }))
  .then(charge => res.render("charge.ejs"));
});

app.listen(7000);

