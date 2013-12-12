/*
 * Copyright 2013 Xiatron LLC
 */

Hoodie.extend(function(hoodie) {
    hoodie.account.socialLogin = function(providerName, /*optional*/options) {
        var popup;

        // open popup immediately to prevent it from being blocked
        popup = new Popup();
        popup.setText('connecting to ' + providerName );

        return awaitNewAuth($.extend({popup: popup, provider: providerName}, options));
    };

    function awaitNewAuth(options) {
        var settings = $.extend({
                attemptLimit:     20,
                interval:         3000,
                authServerUri:    hoodie.baseUrl+'/_api/_auth'
            }, options);
            
        //setup deferal
        var defer = hoodie.defer();
            
        var authUrlOpened = false;
        var destroy = true;
        var pollForAuth = function () {
                //check if we need to destroy the old session (and set to false for single run)
                var appendUri = (destroy) ? '/?destroy=true&uri='+settings.authServerUri : '?uri='+settings.authServerUri;
                destroy = false;

                //decrement attemptLimit
                settings.attemptLimit--;
              
                //loop every x seconds until we either reach the limit or get auth data
                var authTimer = setTimeout(function(){
                    $.ajax({
                        url: settings.authServerUri+appendUri,
                        dataType: 'json',
                        xhrFields: { withCredentials: true }, /* for cross domain support*/
                        success: function(data){
                            //Check if authenticated and reurn data or keep polling
                            if (data.authenticated) {
                                //clear the timer
                                clearTimeout(authTimer);
                           
                                //try to sign in now
                                hoodie.account.signIn(data.id, data.temp_pass)
                                .done(function(doneData){
                                    delete data.temp_pass; //lets not do anything stupid!
                                    settings.popup.close();
                                    defer.resolve(data);
                                })
                                .fail( function(failData){
                                    defer.reject(new Error('signin'));
                                });
                            } else {
                                //open the auth Url if it has not been opened
                                if (!authUrlOpened) {
                                    settings.popup.open(data.auth_urls[settings.provider]);
                                    authUrlOpened = true;
                                }
                           
                                //Setup the next poll recursively
                                if (settings.attemptLimit > 0) pollForAuth();
                            }
                        },
                        error: function(data) {
                            defer.reject(new Error('ajax'));
                        }
                    });
                }, settings.interval);
            };
            
        //start polling
        pollForAuth();
            
        //return the promise of defer
        return defer.promise();
    };
    
    // little popup helper class
    var Popup = function() {
      this.win = window.open('', 'Title', 'toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=yes, resizable=yes, width=600, height=600, top='+Number((screen.height/2)-300)+',left='+Number((screen.width/2)-300));
    }
    Popup.prototype.setText = function() {
      this.win.document.body.innerHTML = 'loading...';
    };
    Popup.prototype.open = function(url) {
      this.win.location.href = url;
    };
    Popup.prototype.resizeTo = function(width, height) {
      this.win.window.resizeTo(width, height);
    };
    Popup.prototype.moveTo = function(x, y) {
      this.win.window.moveTo(x, y);
    };
    Popup.prototype.close = function() {
      this.win.close();
    };
});