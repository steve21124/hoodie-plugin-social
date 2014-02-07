# Hoodie Social Plugin

This plugin allows Hoodie app integration with popular social network providers.  Social authentication, authorization, status updates, get contacts, and get followers are currently supported.  Supported providers currently include Facebook, Twitter, and Google+.

The development of this plugin is sponsored by Appback.com - the future home of Hoodie Hosting!

Please note:  This plugin is under major development and we are actively experimenting to identify the best ways of integrating with Hoodie.  Use at your own risk.

## Installation

Install from the Hoodie CLI

    hoodie install social

## Configuration

Open Pocket, add your provider Key/ID & Secret, then save.

## Methods

Signin to Hoodie through a social provider

    hoodie.account.socialLogin( providerName )
    .done( successCallback)
    .fail( errorCallback );
    
Connect a Hoodie account to a social account (must be logged in)

    hoodie.account.socialConnect( providerName )
    .done( successCallback)
    .fail( errorCallback );
    
Set status message on connected social account (must be logged in)

    hoodie.account.socialSetStatus({
        provider: providerName,
        status: status //string for Facebook/Twitter or Google+ moment payload (see https://developers.google.com/+/api/moment-types/add-activity)
    })
    .done( successCallback)
    .fail( errorCallback );
    
Get a user social profile from a connected provider (defaults to current user)

    hoodie.account.socialGetProfile(provider, /*optional*/{
        /*
        * Supply one of these to get the profile of a different user
        * user_id: userId //provider user ID
        * user_name: userName //provider display or screen name
        */
    })
    .done( successCallback)
    .fail( errorCallback );
    
Get a user's contacts (aka friends or following) from a connected provider (defaults to current user)

    hoodie.account.socialGetContacts(provider, /*optional*/{
        /*
        * Supply one of these to get the contacts of a different user
        * user_id: userId //provider user ID
        * user_name: userName //provider display or screen name
        */
    })
    .done( successCallback)
    .fail( errorCallback );
    
Get a user's followers (aka subscribers) from a connected provider (defaults to current user)

    hoodie.account.socialGetFollowers(provider, /*optional*/{
        /*
        * Supply one of these to get the followers of a different user
        * user_id: userId //provider user ID
        * user_name: userName //provider display or screen name
        */
    })
    .done( successCallback)
    .fail( errorCallback );

## Sample use

    <!DOCTYPE html>
        <head>
            <meta http-equiv="Content-type" content="text/html;charset=UTF-8">
        </head>
        <body style="text-align: center; padding 100px; width: 100%;">
            <p id="welcome">Login with:<br /><a href="javascript:auth('facebook');">Facebook</a> | <a href="javascript:auth('twitter');">Twitter</a> | <a href="javascript:auth('google');">Google Plus</a></p>
            <p style="display: none;" id="connect">Connect to:<br /><a href="javascript:connect('facebook');">Facebook</a> | <a href="javascript:connect('twitter');">Twitter</a> | <a href="javascript:connect('google');">Google</a></p>
            <p id ="profile"></p>
            <script src="http://code.jquery.com/jquery-1.10.2.min.js"></script>
            <script src="https://YOUR-HOST-HERE/_api/_files/hoodie.js"></script>
            <script>
                var hoodie = new Hoodie('https://YOUR-HOST-HERE');
                
                //start fresh
                hoodie.account.signOut();
                
                var auth = function(provider) {
                    $('#welcome').text('Loading...');
                    hoodie.account.socialLogin(provider)
                    .done(function(data) {
                        var status = (provider == 'google') ? {"type":"http://schemas.google.com/DiscoverActivity","target":{"url":"https://developers.google.com/+/web/snippet/examples/thing"}} : 'I just logged in with a test app.  Please ignore this.  I\'ll surely be deleting it soon!';
                        
                        //send a test post
                        hoodie.account.socialSetStatus({
                            provider: provider,
                            status: status,
                        }).done(function(data){
                            console.log(data);
                        });
                    
                        //update some stuff
                        $('#connect').show();
                        $('#welcome').text('Your Hoodie ID: '+data.id);
                        $('#profile').html(JSON.stringify(data.full_profile));
                            
                    })
                    .fail(function(error){
                        console.log(error);
                    });
                }
                var connect = function(provider) {
                    hoodie.account.socialConnect(provider)
                    .done(function(data){
                        $('#connect').hide();
                        $('#welcome').append('<br /><br />'+JSON.stringify(data.connections));
                    })
                    .fail(function(error){
                        console.log(error);
                    })
                    .then(function(){
                        //get the users profile
                        hoodie.account.socialGetProfile(provider)
                        .done(function(data){
                            console.log(data);
                        });
                        
                        //get the users friends (aka people they follow)
                        hoodie.account.socialGetContacts(provider)
                        .done(function(data){
                            console.log(data);
                        });
                        
                        //get the users followers (aka subscribers)
                        hoodie.account.socialGetFollowers(provider)
                        .done(function(data){
                            console.log(data);
                        });
                    });
                }
            </script>
        </body>
    </html>
                
## Phonegap Use

For Phonegap powered apps, be sure to include the inAppBrowser feature and whitelist all domains associated with the provider authorization loop.

    <access origin="*" />
    
    <feature name="InAppBrowser">
        <param name="ios-package" value="CDVInAppBrowser" />
    </feature>
                            
## How Login works

The plugin includes a backend component that listens and processes social requests by the Hoodie front-end on a custom port that is reverse proxied by CouchDB.  A cookie session is established with the backend to track the authorization progress and a specific provider auth url is opened in a plugin managed popup window.  The plugin then continuously polls the backend until confirmation and data about the authorization is received.  Upon successful authorization, and subsequent Hoodie sign in, the plugin returns the deferred promise with data about the authentication session and the user.

In the background, the plugin grabs key information to identify whether the social user already exists in the CouchDB _users database.  Most social providers provide an email address, so if it is available that's what we use as the Hoodie ID.  Otherwise, a unique ID is produced from a hash of the user’s display name and provider ID.  In either case, a user is created if necessary and the user details are included with the success callback data.

The backend of the plugin also produces a unique strong password that is immediately applied to that user's doc.  This password is delivered to the front-end of the plugin and a standard Hoodie signIn() is performed.

IMPORTANT:  Because this sensitive information is exchanged by the plugin components, SSL should always be used.  Also, be aware the the ability to perform a traditional hoodie.account.signIn() will be impaired (for now).  Future plugin revisions may use a different solution such as CouchDB oAuth or Proxy Authentication, but for now this is the easiest approach while preserving all other Hoodie native functionality.

    

## Copyright

(c) 2013 Xiatron LLC