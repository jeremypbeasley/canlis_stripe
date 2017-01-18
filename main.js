// SETTING KEY
Stripe.setPublishableKey('pk_test_Gbu2akKhNgGjbKi4LPxOOWqc');

// CREATING SINGLE USE TOKEN
$(function() {
  var $form = $('#payment-form');
  $form.submit(function(event) {
    // Disable the submit button to prevent repeated clicks:
    $form.find('.submit').prop('disabled', true);
    // Request a token from Stripe:
    Stripe.card.createToken($form, stripeResponseHandler);
    // Prevent the form from being submitted:
    return false;
  });
});

// SENDING FORM 
function stripeResponseHandler(status, response) {
  // Grab the form:
  var $form = $('#payment-form');

  if (response.error) { // Problem!

    // Show the errors on the form:
    $form.find('.payment-errors').text(response.error.message);
    $form.find('.submit').prop('disabled', false); // Re-enable submission

  } else { // Token was created!

    // Get the token ID:
    var token = response.id;

    // Insert the token ID into the form so it gets submitted to the server:
    $form.append($('<input type="hidden" name="stripeToken">').val(token));
    console.log(token);

    // Submit the form:
    $form.get(0).submit();
  }
};

// AUTOFILL FOR TESTING

$( document ).ready(function() {
  $('[name="name"]').val("Bob Test");
  $('[name="shipping_address_line1"]').val("123 Lois Lane");
  $('[name="shipping_address_apt"]').val("Suite B");
  $('[name="shipping_address_city"]').val("Seattle");
  $('[name="shipping_address_state"]').val("Washington");
  $('[name="shipping_address_country"]').val("United States");
  $('[name="shipping_address_zip"]').val("98144");
  $('[name="stripeEmail"]').val("bob@schoolsout.com");
  $('[name="stripeEmail"]').val("bob@schoolsout.com");
  $('#cc').val("4242424242424242");
  $('#ccm').val("12");
  $('#ccy').val("19");
  $('#cvv').val("123");
});

  