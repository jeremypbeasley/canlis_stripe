const stripe = require('stripe')('sk_test_6WJQa1yojkGWLQ2mW706ppbe');

const product = stripe.products.update(
  'prod_HrPITI1pgXTYXs',
  {
    type: 'good'
  }
);
