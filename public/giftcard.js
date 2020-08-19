$( document ).ready(function() {
  // TESTING ONLY - Form auto fill
  // $('[name="customer_name"]').val("Jeremy Beasley");
  // $('[name="from_name"]').val("Jeremy");
  // $('[name="customer_phone"]').val("2061234567");
  // $('[name="recipient_name"]').val("Jane");
  // $('[name="recipient_message"]').val("Ignore this transaction. Testing.");
  // $('#ShipToMe').prop("checked", true);
  // $('[name="shipping_address_name"]').val("Jane Ellen Beasley");
  // $('[name="shipping_address_line1"]').val("800 26th Ave S.");
  // $('[name="shipping_address_line2"]').val("");
  // $('[name="shipping_address_city"]').val("Seattle");
  // $('[name="shipping_address_state"]').val("Washington");
  // $('[name="shipping_address_country"]').val("United States");
  // $('[name="shipping_address_postal_code"]').val("98144");
  // $('[name="stripeEmail"]').val("jeremy@bsley.com");
  // $('#cc').val("4242424242424242");
  // $('#ccm').val("09");
  // $('#ccy').val("24");
  // $('#cvv').val("123");
  // $('.FormItem').addClass("active");
  // $('.InputGiftAmount').val("10");

  // "You will be charged.." Dialogue
  var shippingCost = 0;
  var enteredAmount;
  function showTotalCharge() {
    if (enteredAmount) {
      totalCharge = enteredAmount + shippingCost;
      $("#YouWillBeCharged").show().text("You will be charged a total of $" + totalCharge + ".00");
    }
  }
  $("#YouWillBeCharged").hide()
  $(".GiftAmount input").keyup(function() {
      enteredAmount = Number($(this).val());
      if (enteredAmount) {
        showTotalCharge();
      } else {
        $("#YouWillBeCharged").hide().text("");
      };
  }).keyup();

  // Shipping Info Toggle
  $(".ShippingInformation").hide();
  $('.ShippingSelector').click(function() {
    if($('#ShipToMe').is(':checked')) {
      $(".ShippingInformation").show();
      shippingCost = 5;
      showTotalCharge();
    }
    if ($('#ShipToRecipient').is(':checked')) {
      $(".ShippingInformation").show();
      shippingCost = 5;
      showTotalCharge();
    }
    if ($('#ShipToPickup').is(':checked')) {
      $(".ShippingInformation").hide();
      shippingCost = 0;
      showTotalCharge();
    }
  });

  // Input text field animations
  $('input.InputText').each(function() {
    $(this).on('focus', function() {
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

  // Select input animations
  $('.StateLabel').click(function() {
    $('.StateSelector select').focus();
    $('.StateSelector select').addClass("Active");
  });
  $('.StateSelector select').each(function() {
    $(this).on('focus', function() {
      $('.StateLabel').addClass("Active");
      $(this).removeClass("Default");
    });
  });

});

// Erase address autocomplete if "Pick up at canlis" is selected
// todo: include in ready.function above
$('#ShipToPickup').click(function() {
  $('[name="shipping_address_line1"]').val("");
  $('[name="shipping_address_line2"]').val("");
  $('[name="shipping_address_city"]').val("");
  $('[name="shipping_address_state"]').val("");
  $('[name="shipping_address_country"]').val("");
  $('[name="shipping_address_postal_code"]').val("");
});

// Form validation & error messages

// Note: this key must match what is in the .env file. See README.
// todo: pull pull this from dotenv so there's one less place to change it
Stripe.setPublishableKey('pk_live_4kvjDESffDHa3yDxThoVTXUK');

// Validating the form
$("#payment-form").submit(function(event) {
  // todo: pull jquert.validate from package, not static repo
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
      shipping_address_line1: {
        required: ["#ShipToMe:checked", "#ShipToRecipient:checked"]
      },
      shipping_address_city: {
        required: ["#ShipToMe:checked", "#ShipToRecipient:checked"]
      },
      shipping_address_state: {
        required: ["#ShipToMe:checked", "#ShipToRecipient:checked"],
        // equals: ["AL", "AK", "AZ"],
      },
      shipping_address_postal_code: {
        required: ["#ShipToMe:checked", "#ShipToRecipient:checked"]
      },
    },
    messages: {
      stripeAmount: {
        required: "Please tell us how much you you'd like on your gift card.",
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
        required: "We'll need your phone in case we have to contact you.",
        digits: "Please enter your phone number with only numbers and no spaces."
      },
      recipient_name: {
        required: "Please tell us who this gift card is for.",
      },
      shipping_preference: {
        required: "Please let us know how you'd like your card delivered.",
      },
      shipping_address_line1: {
        required: "Please enter a valid address."
      },
      shipping_address_name: {
        required: "Please enter your recipient's name."
      },
      shipping_address_city: {
        required: "Please enter a valid city name."
      },
      shipping_address_state: {
        required: "Please select a state.",
      },
      shipping_address_postal_code: {
        required: "Please enter a valid ZIP code."
      },
    },
    errorPlacement: function(error, element) {
      if (element.is(":radio")) {
        error.prependTo(element.parents('.ShippingPreference'));
      }
      else {
        error.insertAfter(element);
      }
    }
  });
  if(!$("#payment-form").valid()){
    // If there are errors, scroll up to see the error message
    $('body, html').animate({ scrollTop: 0 }, 200);
    event.preventDefault();
    return false;
  }
  if($("#payment-form").valid()){
    // Disable the submit button to prevent repeated clicks
    $(this).find('.SubmitButton').prop('disabled', true);
    // Make the submit button show progress
    $(this).find('.SubmitButton').addClass('Loading');
    // Request a token from Stripe:
    Stripe.card.createToken($("#payment-form"), stripeResponseHandler);
    // Prevent the form from being submitted:
    return false;
  }
});

// Render any error visible at the top of the form
function renderErrors(errorString) {
  $('body, html').animate({ scrollTop: 0 }, 200);
  $('.FormErrorsCont').show();
  setTimeout(function(){
    $('.FormErrorsCont').addClass("Active");
    $('.FormErrors').addClass("Active");
    $('.FormErrors').text(errorString);
  }, 400);
}

// Send the form
function stripeResponseHandler(status, response) {
  var $form = $('#payment-form');
  if (response.error) {
    renderErrors(response.error.message);
    $form.find('.submit').prop('disabled', false);
  } else {
    var token = response.id;
    $form.append($('<input type="hidden" name="stripeToken">').val(token));
    console.log(token);
    // todo: use promises instead of this timeout garbage
    setTimeout(function(){
      $('.SubmitButton').removeClass('Loading');
      $('.SubmitButton').addClass('Complete');
    }, 1000);
    setTimeout(function(){
      $form.get(0).submit();
    }, 1000);
  }
};
