/*
 * Copyright 2013 Xiatron LLC
 */

Hoodie.extend(function(hoodie) {
    hoodie.account.socialLogin = function(options) {
        var settings = $.extend({
                attemptLimit:     20,
                destroy:          true,
                interval:         3000,
                authServerUri:    hoodie.baseUrl+'/_api/_auth',
                failCallback:     function(data){console.log(JSON.stringify(data));},
                initCallback:     function(data){console.log(JSON.stringify(data));},
                sessionCallback:  function(data){console.log(JSON.stringify(data));}
            }, options),
            initCbCalled = false,
            pollForAuth = function () {
                //check if we need to destroy the old session (and set to false for single run)
                var appendUri = (settings.destroy) ? '/?destroy=true&uri='+settings.authServerUri : '?uri='+settings.authServerUri; settings.destroy = false;

                //decrement attemptLimit
                settings.attemptLimit--;
              
                //loop every x seconds until we either reach the limit or get auth data
                var authTimer = setTimeout(function(){
                    $.ajax({
                        url: settings.authServerUri+appendUri,
                        dataType: 'json',
                        xhrFields: { withCredentials: true }, /* for cross domain support*/
                        success: function(data){
                            //run the init callback and pass current data
                            if (!initCbCalled && settings.initCallback != undefined) {
                                initCbCalled = true;
                                delete data.temp_pass; //for good measure!
                                settings.initCallback(data);
                            }
                            //Check if authenticated and reurn data or keep polling
                            if (data.authenticated) {
                                //clear the timer
                                clearTimeout(authTimer);
                           
                                //try to sign in now
                                hoodie.account.signIn(data.id, data.temp_pass).done(function(doneData){
                                    delete data.temp_pass; //lets not do anything stupid!
                                    settings.sessionCallback(data);
                                }).fail( function(failData){
                                    settings.failCallback(failData);
                                });
                            } else {
                                //Setup the next poll recursively
                                if (settings.attemptLimit > 0) pollForAuth();
                            }
                        },
                        error: settings.failCallback
                    });
                }, settings.interval);
            };
            
            //start polling
            pollForAuth();
    };
});