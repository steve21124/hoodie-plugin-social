# Hoodie Social Plugin

This plugin allows Hoodie app integration with popular social network providers.  Social authentication is currently supported, with many other features planned for the near future - including authorization, status updates, profiles, friends, and activity streams.  Supported providers currently include Facebook, Twitter, and Google.

The development of this plugin is sponsored by Appback.com - the future home of Hoodie Hosting!

Please note:  This plugin is under major development and we are actively experimenting to identify the best ways of integrating with Hoodie.  Use at your own risk.

## Methods

Signin to Hoodie through a social provider

    hoodie.account.socialLogin({
        initCallback: function(data) {
            // callback after the backend registers a request
        },
        sessionCallback: function(data) {
            // callback after a Hoodie session is established
        }
    });

## Sample use

    <!DOCTYPE html>
        <head>
            <meta http-equiv="Content-type" content="text/html;charset=UTF-8">
        </head>
        <body style="text-align: center; padding 100px; width: 100%;">
            <p id="welcome">Login with:<br /><a href="javascript:auth('facebook');">Facebook</a> | <a href="javascript:auth('twitter');">Twitter</a> | <a href="javascript:auth('google');">Google</a></p>
            <p id ="profile"></p>
            <script src="http://code.jquery.com/jquery-1.10.2.min.js"></script>
            <script src="http://your-host:your-port/_api/_files/hoodie.js"></script>
            <script>
                var hoodie = new Hoodie('http://your-host:your-port');
                var loginWindow;
                var auth = function(provider) {
                    $('#welcome').text('Loading...');
                    hoodie.account.socialLogin({
                        initCallback: function(data) {
                            if (!data.authenticated) {
                                loginWindow = window.open(data.auth_urls[provider],'Login','height=600,width=600,top='+Number((screen.height/2)-300)+',left='+Number((screen.width/2)-300));
                            }
                        },
                        sessionCallback: function(data) {
                            loginWindow.window.close();
                            $('#welcome').text('Your Hoodie ID: '+data.id);
                            $('#profile').html(JSON.stringify(data.full_profile));
                        }
                    });
                }
            </script>
        </body>
    </html>
    
## How it works

The plugin includes a backend component that listens and processes social requests by the Hoodie front-end on a custom port proxied by CouchDB.  Authentication through a social provider requires two steps; 1) ajax registration of an new auth request, then 2) completion of authorization through the social provider of choice.

During step-1 of the process, the plugin establishes a cookie session with the backend to track the authorization progress.  The plugin initCallback returns an array of authorization urls (data.auth_urls) for each enabled provider.  You can then present the provider url of choice using what ever method you see fit within your application (window, modal, iframe, etc).  We leave this part up to you.

While you handle the business of presenting the provider screens, the plugin continuously polls the backend until confirmation and data about the authorization is received.  Upon successful authorization completion, the plugin fires the sessionCallback and returns data about the authentication session and the user.

In the background, the plugin grabs key information to identify whether the social user already exists in the CouchDB _users database.  Most social providers provide an email address, so if it is available that's what we use as the Hoodie ID.  Otherwise, a unique ID is produced from a hash of the user’s display name and provider ID.  In either case, a user is created if necessary and the user details are included with the sessionCallback data.

The backend of the plugin also produces a unique strong password that is immediately applied to that user's doc.  This password is delivered to the front-end of the plugin and a standard Hoodie signIn() is performed.

IMPORTANT:  Because this sensitive information is exchanged by the plugin components, SSL should always be used.  Also, be aware the the ability to perform a traditional hoodie.signIn() will be impaired (for now).  Future plugin revisions may use a different solution such as CouchDB oAuth or Proxy Authentication, but for now this is the easiest approach while preserving all other Hoodie native functionality.

    

## Copyright

(c) 2013 Xiatron LLC