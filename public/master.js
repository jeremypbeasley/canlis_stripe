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