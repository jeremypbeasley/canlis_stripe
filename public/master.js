

// AUTOFILL FOR TESTING

$( document ).ready(function() {



  // $('[name="customer_name"]').val("Kurt Cobain");
  // $('[name="customer_phone"]').val("1234567890");
  // $('[name="recipient_name"]').val("Courtney Love");
  // $('[name="shipping_address_line1"]').val("171 Lake Washington Blvd E");
  // $('[name="shipping_address_line2"]').val("");
  // $('[name="shipping_address_city"]').val("Seattle");
  // $('[name="shipping_address_state"]').val("Washington");
  // $('[name="shipping_address_country"]').val("United States");
  // $('[name="shipping_address_postal_code"]').val("98112");
  // $('[name="stripeEmail"]').val("kurtyboy@hotmail.com");
  // $('#cc').val("4242424242424242");
  // $('#ccm').val("12");
  // $('#ccy').val("19");
  // $('#cvv').val("123");

  $(".ShippingInformation").hide();

  $('.ShippingSelector').click(function() {
    if($('#ShipToMe').is(':checked')) { 
      $(".ShippingInformation").show();
    }
    if ($('#ShipToRecipient').is(':checked')) { 
      $(".ShippingInformation").show();
    }
    if ($('#ShipToPickup').is(':checked')) { 
      $(".ShippingInformation").hide();
    }
  });

  // CLEVER ANIMATED FORM FIELDS

  $('input.InputText').each(function() {
    $(this).on('focus', function() {
      console.log("its in focus");
      $(this).parent('.FormItem').addClass('active');
    });
    $(this).on('blur', function() {
      if ($(this).val().length == 0) {
       $(this).parent('.FormItem').removeClass('active');
      }
      if ($(this).val() != '') {          
        $(this).parent('.FormItem').addClass('active');
      }
    });
  });

  $('.StateLabel').click(function() {
    $('.StateSelector select').focus();
    $('.StateSelector select').addClass("Active");
  });

  $('.StateSelector select').each(function() {
    $(this).on('focus', function() {
      $('.StateLabel').addClass("Active");
      $(this).removeClass("Default");
    });
    // $(this).on('blur', function() {
    //   if ($(this).val().length == 0) {
    //     $('.StateLabel').show();
    //     $('this').removeClass("Default");
    //   }
    //   if ($(this).val() != '') {          
    //     $('.StateLabel').show();
    //     $('this').addClass("Default");
    //   }
    // });
  });



});

// SETTING KEY
Stripe.setPublishableKey('pk_test_Gbu2akKhNgGjbKi4LPxOOWqc');

//CREATING SINGLE USE TOKEN
// $(function() {
//   var $form = $('#payment-form');
//   $('#payment-form').submit(function(event) {
//     // Disable the submit button to prevent repeated clicks:
//     $(this).find('.submit').prop('disabled', true);
//     // Request a token from Stripe:
//     Stripe.card.createToken($form, stripeResponseHandler);
//     // Prevent the form from being submitted:
//     return false;
//   });
// });

$("#payment-form").submit(function(event) {
  $("#payment-form").validate({
    rules: {
      stripeAmount: {
        required: true,
        digits: true
      },
      customer_name: {
        required: true
      },
      stripeEmail: {
        required: true,
        email: true
      },
      customer_phone: {
        required: true,
        digits: true
      },
      recipient_name: {
        required: true,
      },
      shipping_preference: {
        required: true,
      },
    },
    messages: {
      stripeAmount: {
        required: "Please tell us how much you want your gift card to be for.",
        digits: "Please enter a valid whole number."
      },
      customer_name: {
        required: "We'll need your name, please."
      },
      stripeEmail: {
        required: "We'll need your email address in case we have to contact you about your card.",
        email: "Your email address must be in the format of name@domain.com"
      },
      customer_phone: {
        required: "We'll need your phone in case we have to contact you about your card.",
        digits: "Please enter your phone number with only numbers and no spaces."
      },
      recipient_name: {
        required: "We'll need to know who this gift card is for.",
      },
      shipping_preference: {
        required: "Please let us know how you'd like your card delivered.",
      },
    },
    errorPlacement: function(error, element) {
      if (element.is(":radio")) {
        error.prependTo(element.parents('.ShippingPreference'));
        // error.append('#ShippingHeadline');
      }
      else { 
        error.insertAfter(element);
      }
    }
  });
  if(!$("#payment-form").valid()){
    console.log("aint valid");
    event.preventDefault();
    return false;
  }
  if($("#payment-form").valid()){
    console.log("is valid");
    // Disable the submit button to prevent repeated clicks:
    $(this).find('.submit').prop('disabled', true);
    // Request a token from Stripe:
    Stripe.card.createToken($("#payment-form"), stripeResponseHandler);
    // Prevent the form from being submitted:
    return false;
  }    
});

function renderErrors(errorString) {
  $('body, html').animate({ scrollTop: 0 }, 200);
  $('.FormErrorsCont').show();
  setTimeout(function(){ 
    $('.FormErrorsCont').addClass("Active"); 
    $('.FormErrors').addClass("Active"); 
    $('.FormErrors').text(errorString);
  }, 400);
}

// SENDING FORM 
function stripeResponseHandler(status, response) {
  // Grab the form:
  var $form = $('#payment-form');

  if (response.error) { // Problem!
    // Show the errors on the form:
    renderErrors(response.error.message);
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






// var validator = new FormValidator('payment-form', [
// {
//     name: 'stripeAmount',
//     display: 'whahahaaah',
//     rules: 'required'
// }, {
//     name: 'customer_name',
//     rules: 'required'
// }, {
//     name: 'stripeEmail',
//     rules: 'valid_email'
// }
// ], function(errors, event) {
//     if (errors.length > 0) {
//         console.log("there are errors")
//         return false;
//         // $('#payment-form').submit(function(event) {
//         //   return false;
//         // });
//     }
//     if (errors.length < 0) {
//         console.log("there are NOT errors");
//         return true
//     }
// });



