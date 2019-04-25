### How to run

First, `npm install` then `npm run start`.

### Environment variables

To run this app locally, you'll need to configure your environment with a few keys located in various files.

1. In a file titled `.env` located in the root of the repo. If you don't have this file, go ahead and create it. Swap out the prod keys for test keys in the following places:

keyPublishable=pk_test_XXXXXXXXXXXX

keySecret=sk_test_XXXXX

mailchimpApiKey=XXXXX

mailchimpListId=XXXXX

mailchimpDataCenter=us15

googleAppsUsername=name@domain.com

googleAppsPassword=XXXXX

productId=prod_XXXXX


2. On line `114` of `/public/giftcard.js` with the same key you used for `keyPublishable` in `.env`. Don't forget to change this back to the live keys when you deploy, otherwise you'll break the app in production.

Note: In production, this `.env` file is replaced by Heroku's ["Config Vars"](https://devcenter.heroku.com/articles/config-vars) so there's no need to deploy it. It's currently ignored in the `.gitignore` to ensure this.
