// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'

var app = angular.module('starter', ['ionic', 'ionic.cloud', 'lib', 'ngSanitize', 'btford.socket-io', 'ngCordova', 'monospaced.elastic', 'angular-smilies', 'ngStorage']);

app.run(function($ionicPlatform, $rootScope) {
  $ionicPlatform.ready(function() {
    $rootScope.android = ionic.Platform.isAndroid();
    if(window.cordova && window.cordova.plugins.Keyboard) {
      // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
      // for form inputs)
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);

      // Don't remove this line unless you know what you are doing. It stops the viewport
      // from snapping when text inputs are focused. Ionic handles this internally for
      // a much nicer keyboard experience.
      cordova.plugins.Keyboard.disableScroll(true);
    }
    if(window.StatusBar) {
      StatusBar.styleDefault();
      StatusBar.overlaysWebView(false);
    }
    window.addEventListener('native.keyboardshow', keyboardShowHideHandler);
    window.addEventListener('native.keyboardhide', keyboardShowHideHandler);

    function keyboardShowHideHandler(e) {
      $rootScope.$broadcast("keyboardShowHideEvent");
    }
  });
});

app.value('messageAudio', new Audio('sounds/meow.mp3'));

app.factory('mySocket', function(socketFactory) {
  var myIoSocket = io.connect('http://shutapp.nu:3000');
  socket = socketFactory({
    ioSocket: myIoSocket
  });
  return socket;
});

app.factory('autoLoginManager', function($localStorage) {
  return {
    addUser: function(user) {
      $localStorage.currentUser = user;
    },
    removeUser: function() {
      delete $localStorage.currentUser;
    },
    currentUser: function() {
      return $localStorage.currentUser;
    }
  };
});

app.factory('toaster', function($cordovaToast) {
  return {
    toast: function(message, duration, location) {
      $cordovaToast.show(message, duration, location).then(function(success) {
        console.log("The toast was shown");
      }, function (error) {
        console.log("The toast was not shown due to " + error);
      });
    }
  }
});

app.config(function($stateProvider, $urlRouterProvider, $ionicConfigProvider, $ionicCloudProvider) {
  $stateProvider
    .state('login', {
      url: '/login',
      templateUrl: 'partials/login.html',
      controller: 'LoginController'
    })
    .state('signup', {
      url: '/signup',
      templateUrl: 'partials/signup.html',
      controller: 'SignupController'
    })
    .state('messages', {
      url: '/messages',
      templateUrl: 'partials/messages-and-menu.html',
      controller: 'MessagesController'
    })
    .state('settings', {
      url: '/settings',
      templateUrl: 'partials/settings.html',
      controller: 'SettingsController'
    });
  $urlRouterProvider.otherwise('/login');
  $ionicConfigProvider.views.maxCache(0);
  $ionicCloudProvider.init({
    "core": {
      "app_id": "381a5d8c"
    },
    //inject $ionicPush to push
    "push": {
      "sender_id": "195920830260",
      "pluginConfig": {
        "ios": {
          "badge": true,
          "sound": true
        },
        "android": {
          "iconColor": "#343434"
        }
      }
    }
  });
});

function limitTextarea(textarea, maxLines, maxChar) {
  var lines = textarea.value.replace(/\r/g, '').split('\n'), lines_removed, char_removed, i;
  if (maxLines && lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines_removed = 1
  }
  if (maxChar) {
    i = lines.length;
    while (i-- > 0) if (lines[i].length > maxChar) {
      lines[i] = lines[i].slice(0, maxChar);
      char_removed = 1
    }
    if (char_removed || lines_removed) {
      textarea.value = lines.join('\n')
    }
  }
}

app.controller('LoginController', function ($rootScope, $scope, $location, userManager, toaster, autoLoginManager) {
  //Needed on scope before login credentials are entered by user.
  $scope.login = {};

  if(autoLoginManager.currentUser()) {
    $rootScope.user = autoLoginManager.currentUser();
    $location.path('/messages'); //Redirects to /messages.
  };

    $scope.userLogin = function () {
        if ($scope.login.username === undefined || $scope.login.password === undefined) {
            console.log('Invalid logininformation.');
            toaster.toast('Felaktiga inloggningsuppgifter.', 'long', 'bottom');
        } else {
            userManager.login($scope.login.username, $scope.login.password).then(function (res) {
                console.log('Login successful.');
                $rootScope.user = {
                    id: res.data._id,
                    name: res.data.username,
                    image: res.data.image
                };
                autoLoginManager.addUser($rootScope.user);
                $location.path(res.data.redirect); //Redirects to /messages.
            }, function (res) {
                console.log('Login failed on server.');
                toaster.toast('Felaktiga inloggningsuppgifter!', 'long', 'bottom');
            });
        }
    };
});

app.controller('SignupController', function ($location, $scope, $rootScope, userManager, toaster) {
  $scope.userSignup = function (signup) {
    if (signup === undefined || signup.email === undefined || signup.username === undefined || signup.password === undefined || signup.passwordagain === undefined) {
      var message = "";
      if(signup.username === undefined) message += "Du måste välja ett användarnamn som innehåller minst tre tecken och max 20 tecken." +
      "\nDu kan inte använda speciella tecken, endast siffror och bokstäver(a-z).";
      if(signup.email === undefined) {
        if(message.length > 0) message += "\n";
        message += "Felaktig emailadress.";
      };
      if(signup.password === undefined) {
        if(message.length > 0) message += "\n";
        message += "Du måste välja ett lösenord som innehåller minst sex tecken och max 50 tecken.";
      };
      toaster.toast(message, 'long', 'bottom');
    } else if(signup.password !== signup.passwordagain) {
      toaster.toast('Du skrev in lösenordet olika i de två fälten.', 'long', 'bottom');
    } else {
      userManager.signupuser({
        username: signup.username,
        email: signup.email,
        password: signup.password
      }).then(function (res) { //Successful codes 100-399.
        console.log("Signup OK. Redirecting to login.");
        toaster.toast("Användare registrerad.", "long", "bottom");
        $location.path(res.data.redirect);
      }, function (res) { //Failed codes 400-599+?
        console.log("Signup failed.");
        var message = "";
        switch (res.data.reason) {
          case "username":
            message = "Användarnamnet är upptaget.";
            break;
          case "email":
            message = "Emailadressen är redan registrerad.";
            break;
          default:
            message = "Det blev lite fel!";
        }
        toaster.toast(message, 'long', 'bottom');
      });
    }
  };
});

app.controller('MessagesController', function ($rootScope, $scope, $location, $ionicPush, $ionicScrollDelegate, $ionicSideMenuDelegate, toaster, messageManager, mySocket, userManager, messageAudio) {
  mySocket.removeAllListeners();

  $scope.$on("keyboardShowHideEvent", function() {
    $ionicScrollDelegate.scrollBottom();
  })

  $rootScope.$watch('messages', function () {
    if (!$rootScope.messages || $rootScope.messages.length <= 0) {
      $scope.noMessages = true;
    } else {
      $scope.noMessages = false;
      $ionicScrollDelegate.scrollBottom();
    }
  }, true);

  if (!$rootScope.user) {
    console.log("User not logged in! Redirecting to login.");
    $location.path('/login');
  } else {
    //Register the device and get an id to be able to receive push notifications
    $ionicPush.register().then(function(t) {
      $rootScope.user.token = t.token;
      var postObj = {id: $rootScope.user.id, token: t.token};
      //Save device to user in database
      userManager.addDevice(postObj);
      return $ionicPush.saveToken(t);
    }).then(function(t) {
      //alert("Token: " + t.token);
    });
    /*This is for testing purposes
    $scope.$on('cloud:push:notification', function(event, data) {
      var msg = data.message;
      alert(msg.title + ': ' + msg.text);
    });
    */
    $scope.text = {};
    $scope.text.message = "";
    $rootScope.newMessages = [];
    mySocket.connect();
    mySocket.on('chatroom message', function (msg) {
      $rootScope.messages.push(msg);
    });
    mySocket.on('private message', function (message) {
      //Trying to add user to user conversations list
      if (message.senderId == $rootScope.user.id) {
        if (!$rootScope.conversations.map(function (obj) { return obj.id; }).includes(message.recipientId)) {
          $rootScope.conversations.push({ name: message.recipientName, id: message.recipientId });
        }
      } else {
        if (!$rootScope.conversations.map(function (obj) { return obj.id; }).includes(message.senderId)) {
          $rootScope.conversations.push({ name: message.senderName, id: message.senderId });
        }
      }

      if ($rootScope.privateRecipient && (message.senderId == $rootScope.privateRecipient.id || message.senderId == $rootScope.user.id)) {
        $rootScope.messages.push(message);
      } else {
        $rootScope.newMessages.push(message.senderId);
        messageAudio.play();
      }
    });
    mySocket.on('connect message', function (msg) {
      $rootScope.statusMessage = msg;
    });
    mySocket.on('disconnect message', function (msg) {
      $rootScope.statusMessage = msg;
    });

    $scope.changeRecipientFromMessage = function(message) {
        var socketId = $rootScope.activeUsers.filter(function(user) {
            if(message.senderId == user.id) return user.socketId;
        });
        $rootScope.changeRecipient({
            name: message.senderName,
            id: message.senderId,
            socketId: socketId
        });
    }

  $rootScope.changeRecipient = function changeRecipient(recipient) {
        $rootScope.isPrivate = true;
        $rootScope.selected = recipient.id;
        $rootScope.privateRecipient = recipient;
        $rootScope.chatroom = undefined;
        if ($rootScope.selectedChatroom) {
            mySocket.emit('leave chatroom', $rootScope.selectedChatroom);
        }
        if ($rootScope.newMessages.includes(recipient.id)) {
            $rootScope.newMessages.splice($rootScope.newMessages.indexOf(recipient.id), 1);
        }
        if (!$rootScope.user) {
            console.log("User not logged in! Redirecting to login.");
            $location.path('/');
        } else {
            $location.path('/messages');
            messageManager.getPrivateMessages($rootScope.user.id, $rootScope.privateRecipient.id).then(function(res) {
                $rootScope.messages = res.data;
            });
        }
        $rootScope.messagesBarTitle = $rootScope.privateRecipient.name;
  };

    /*
    //get list of users with which we have had a conversation
    messageManager.getConversations($rootScope.user.id).then(function(res) {
        $rootScope.conversations = res.data;
    /*socket.on('join chatroom', function () {
     document.getElementById('my-message').focus();
     });*/
    mySocket.on('change username', function(obj) {
      for(var i=0; i<$rootScope.conversations.length; i++) {
        if($rootScope.conversations[i].id == obj.id) {
          $rootScope.conversations[i].name = obj.newUserName;
        }
      }
    });

    //send $rootScope.user to server.js, it receives it with socket.on('connected')
    mySocket.emit('connected', $rootScope.user);
    mySocket.emit('connect message', { date: new Date(), text: $rootScope.user.name + " har loggat in." });
    if (!$rootScope.selectedChatroom) {
      $rootScope.selected = "591d5683f36d281c81b1e5ea";
      $rootScope.selectedChatroom = $rootScope.selected; // "general"
      mySocket.emit('join chatroom', $rootScope.selectedChatroom);
      $rootScope.messagesBarTitle = "#general";
    }

    messageManager.getMessages($rootScope.selectedChatroom).then(function(res) {
      $rootScope.messages = res.data;
      $ionicScrollDelegate.scrollBottom();
    });

    $scope.postMessage = function () {
      var newMessage = {
        "senderId": $rootScope.user.id,
        "senderName": $rootScope.user.name,
        "senderImage": $rootScope.user.image,
        "text": $scope.text.message,
        "chatroom": $rootScope.selectedChatroom
      };
      //Send message to the current chatroom
      mySocket.emit('chatroom message', newMessage);
      messageManager.postMessages(newMessage);
      $scope.text.message = "";
      $ionicScrollDelegate.scrollBottom();
      return false;
    };

    $scope.postPrivateMessage = function () {
      var newPrivateMessage = {
        "senderId": $rootScope.user.id,
        "senderName": $rootScope.user.name,
        "senderImage": $rootScope.user.image,
        "text": $scope.text.message,
        "recipientId": $rootScope.privateRecipient.id,
        "recipientName": $rootScope.privateRecipient.name
      };
      //Send a direct private message.
      mySocket.emit('private message', newPrivateMessage);
      //Post the message to the database
      messageManager.postPrivateMessage(newPrivateMessage);
      $scope.text.message = "";
      $ionicScrollDelegate.scrollBottom();
    };

    $rootScope.toggleLeft = function() {
      $ionicSideMenuDelegate.toggleLeft();
    };
  }
});

app.controller('LeftSideController', function ($rootScope, $location, $timeout, $ionicSideMenuDelegate, $ionicScrollDelegate, $scope, messageManager, mySocket, toaster) {
  $scope.newChatroom = {};

  $timeout(function() {
    $scope.$watch(function () {
      return $ionicSideMenuDelegate.getOpenRatio();
    }, function (ratio) {
      if (ratio == 0) {
        $ionicScrollDelegate.$getByHandle('side-menu-handle').scrollTop();
      }
    });
  });

  $scope.hadConversation = function(userId) {
    return $rootScope.conversations.map(x=>x.id).includes(userId);
  };

  $scope.toggleAddChatroom = function() {
    $scope.addMode = true;
  };

  $scope.addChatroom = function() {
    messageManager.addChatroom({"name": $scope.newChatroom.name}).then(function(res) {
      toaster.toast('Chatrummet ' + $scope.newChatroom.name + ' har skapats.', 'short', 'bottom');
    }, function(res) {
      switch(res.status) {
        case 400:
          toaster.toast('Chatrummet finns redan.', 'short', 'bottom');
          break;
          case 406:
            toaster.toast('Namnet måste vara mellan 3 och 15 tecken långt.', 'short', 'bottom');
            break;
        case 500:
          toaster.toast('Databasfel: Chatrummet kunde inte skapas.', 'short', 'bottom');
          break;
        default:
          toaster.toast('Okänt fel.', 'short', 'bottom');
      }
    });
    $scope.addMode = false;
  };

  if ($rootScope.user) {
    messageManager.getChatrooms().then(function (response) {
      $scope.chatrooms = response.data;
    });
    mySocket.on('active users', function (arr) {
        $rootScope.activeUsers = arr;
        var activeUserIds = arr.map(x=>x.id);
        if(!$rootScope.conversations) {
          messageManager.getConversations($rootScope.user.id).then(function (response) {
            //$rootScope.conversations will always hold all the people the user has chatted with. offlineConversations holds those that are offline.
            //offlineConversations is what is shown in the side menu.
            $rootScope.conversations = response.data;
            $rootScope.offlineConversations = $rootScope.conversations.filter(x=>!activeUserIds.includes(x.id));
          });
        } else {
          $rootScope.offlineConversations = $rootScope.conversations.filter(x=>!activeUserIds.includes(x.id));
        }
    });
    socket.on('refresh chatroom', function (chatroom) {
      messageManager.getChatrooms().then(function (response) {
        $scope.chatrooms = response.data;
      });
    });
    $scope.changeChatroom = function (index) {
      $rootScope.isPrivate = false;
      $rootScope.selected = index;
      $rootScope.chatroom = this.chatroom;
      $rootScope.privateRecipient = undefined;
      //Leave chatroom if already in one.
      if ($rootScope.selectedChatroom) {
        mySocket.emit('leave chatroom', $rootScope.selectedChatroom);
      }
      $rootScope.selectedChatroom = this.chatroom._id;
      messageManager.getMessages($rootScope.selectedChatroom).then(function(res) {
        $rootScope.messages = res.data;
      });
      mySocket.emit('join chatroom', $rootScope.selectedChatroom);
      $rootScope.messagesBarTitle = "#" + $rootScope.chatroom.name;
    };
  } else {
    console.log("$rootScope.user is undefined, but WHYYY?!?!");
    $location.path("/");
  }
});

app.controller('SettingsController', function ($location, $scope, $rootScope, userManager, toaster, mySocket, autoLoginManager) {
  $scope.goBackToMessages = function() {
    $location.path("/messages");
  };

  $scope.changeUsername = function(newUsername) {
    if(newUsername) {
        userManager.updateUsername({
            "id": $rootScope.user.id,
            "username": newUsername
        }).then(function () {
            $rootScope.user.name = newUsername;
            autoLoginManager.addUser($rootScope.user);
            toaster.toast('Användarnamnet har ändrats.', 'long', 'bottom');
        }, function () {
            toaster.toast('Användarnamnet gick inte att ändra.', 'long', 'bottom');
        });
        mySocket.emit('change username', {"id": $rootScope.user.id, "newUserName": newUsername});
    } else {
        var message = "Du måste välja ett användarnamn som innehåller minst tre tecken och max 20 tecken." +
            "\nDu kan inte använda speciella tecken, endast siffror och bokstäver(a-z).";
        toaster.toast(message, 'long', 'bottom');
    }
  };

  $scope.logout = function() {
    var userId = $rootScope.user.id;
    var token = $rootScope.user.token;
    userManager.removeDevice({id: userId, token: token});
    $rootScope.user = {};
    autoLoginManager.removeUser();
    $location.path('/login');
  };
});
