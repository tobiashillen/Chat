// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'

var app = angular.module('starter', ['angular-smilies', 'btford.socket-io', 'ionic', 'ionic.cloud', 'lib', 'monospaced.elastic', 'ngCordova', 'ngSanitize', 'ngStorage']);

app.run(function ($ionicPlatform, $ionicPopup, $rootScope, $state, stateHandler) {
    //Handle when the app/phone goes active/inactive
    $ionicPlatform.on('pause', stateHandler.goIdle);
    $ionicPlatform.on('resume', stateHandler.goActive);
    //If you press the hardware backbutton on android, shows a dialog box
    //if you are really sure about exiting.
    $ionicPlatform.registerBackButtonAction(function (event) {
        if ($state.current.name == 'messages') {
            $ionicPopup.confirm({
                title: 'Avsluta ShutApp',
                template: 'Är du säker på att du vill avsluta?'
            }).then(function (res) {
                if (res) ionic.Platform.exitApp();
            });
        }
    }, 100);
    $ionicPlatform.ready(function () {
        $rootScope.android = ionic.Platform.isAndroid();
        if (window.cordova && window.cordova.plugins.Keyboard) {
            // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
            // for form inputs)
            cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);

            // Don't remove this line unless you know what you are doing. It stops the viewport
            // from snapping when text inputs are focused. Ionic handles this internally for
            // a much nicer keyboard experience.
            cordova.plugins.Keyboard.disableScroll(true);
        }
        if (window.StatusBar) {
            StatusBar.styleDefault();
            StatusBar.overlaysWebView(false);
        }
        window.addEventListener('native.keyboardshow', keyboardShowHideHandler);
        window.addEventListener('native.keyboardhide', keyboardShowHideHandler);
        document.addEventListener('deviceready', console.log(navigator));

        function keyboardShowHideHandler(e) {
            $rootScope.$broadcast("keyboardShowHideEvent");
        }
    });
});

app.value('messageAudio', new Audio('sounds/meow.mp3'));
app.value('messagesPerLoad', 20);

app.factory('autoLoginManager', function ($localStorage) {
    return {
        addUser: function (user) {
            $localStorage.currentUser = user;
        },
        removeUser: function () {
            delete $localStorage.currentUser;
        },
        currentUser: function () {
            return $localStorage.currentUser;
        }
    };
});

app.factory('mySocket', function (socketFactory) {
    //var myIoSocket = io.connect('http://localhost:3000');
    //var myIoSocket = io.connect('http://shutapp.nu:3000');
    //var myIoSocket = io.connect('http://192.168.1.3:3000');
    var myIoSocket = io.connect('http://172.104.137.232:3000');
    socket = socketFactory({
        ioSocket: myIoSocket
    });
    return socket;
});

app.factory('setNrOfUnreadMessages', function () {
    return {
        set: function (userList, unreadMessages) {
            for (var i = 0; i < userList.length; i++) {
                var senderIds = unreadMessages.map(x => x.senderId);
                if (senderIds.includes(userList[i].id)) {
                    userList[i].nrOfMessages = unreadMessages[senderIds.indexOf(userList[i].id)].nrOfMessages;
                } else {
                    userList[i].nrOfMessages = "";
                }
            }
            var userListStr = userList.toString();
            console.log("userList: " + userListStr);
        }
    }
});

app.factory('socketEvents', function ($ionicScrollDelegate, $location, $rootScope, messageAudio, messageManager, mySocket, setNrOfUnreadMessages) {
    return {
        set: function () {
            mySocket.on('active users', function (arr) {
                var activeUserIds = arr.map(x => x.id);
                $rootScope.activeUsers = arr;
                if (!$rootScope.conversations) {
                    messageManager.getConversations($rootScope.user.id).then(function (response) {
                        //$rootScope.conversations will always hold all the people the user has chatted with. offlineConversations holds those that are offline.
                        //offlineConversations is what is shown in the side menu.
                        $rootScope.conversations = response.data;
                        $rootScope.offlineConversations = $rootScope.conversations.filter(x => !activeUserIds.includes(x.id));
                    });
                } else {
                    $rootScope.offlineConversations = $rootScope.conversations.filter(x => !activeUserIds.includes(x.id));
                    if ($rootScope.unreadMessages) {
                        setNrOfUnreadMessages.set($rootScope.offlineConversations, $rootScope.unreadMessages);
                        console.log("unreadMessages", $rootScope.unreadMessages);
                        console.log("offlineConversations", $rootScope.offlineConversations);
                    }
                }
                if ($rootScope.unreadMessages) {
                    setNrOfUnreadMessages.set($rootScope.activeUsers, $rootScope.unreadMessages);
                }
            });
            mySocket.on('banned', function () {
                console.log('oh no, banned!');
                $rootScope.user = {};
                autoLoginManager.removeUser();
                $location.path('#/login');
                toaster.toast('Du är avstängd!', 'long', 'center');
            });
            mySocket.on('change username', function (obj) {
                for (var i = 0; i < $rootScope.conversations.length; i++) {
                    if ($rootScope.conversations[i].id == obj.id) {
                        $rootScope.conversations[i].name = obj.newUserName;
                    }
                }
            });
            mySocket.on('chatroom message', function (message) {
                $rootScope.messages.push(message);
            });
            mySocket.on('connect message', function (msg) {
                $rootScope.statusMessage = msg;
            });
            mySocket.on('disconnect message', function (msg) {
                $rootScope.statusMessage = msg;
            });
            mySocket.on('edited message', function () {
                messageManager.getMessages($rootScope.selectedChatroom.id, null, $rootScope.messages.length).then(function (res) {
                    $rootScope.messages = res.data;
                });
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
                //If the users are currently in a conversation with each other
                if ($rootScope.privateRecipient && (message.senderId == $rootScope.privateRecipient.id || message.senderId == $rootScope.user.id)) {
                    $rootScope.messages.push(message);
                    var senderObj = {
                        senderId: message.senderId,
                        recipientId: $rootScope.user.id
                    };
                    messageManager.markReadMessages(senderObj).then(function (res) {
                        //console.log("messages marked as read");
                    });
                } else {
                    if (!$rootScope.unreadMessages.map(x => x.senderId).includes(message.senderId)) {
                        $rootScope.unreadMessages.push({ senderId: message.senderId, nrOfMessages: 1 });
                    } else {
                        $rootScope.unreadMessages[$rootScope.unreadMessages.map(x => x.senderId).indexOf(message.senderId)].nrOfMessages++;
                    }
                    //Maybe put an if statement here
                    setNrOfUnreadMessages.set($rootScope.activeUsers, $rootScope.unreadMessages);
                    setNrOfUnreadMessages.set($rootScope.offlineConversations, $rootScope.unreadMessages);

                    messageAudio.play();
                    $ionicScrollDelegate.scrollBottom();
                }
            });
            mySocket.on('refresh chatroom', function (chatroom) {
                messageManager.getChatrooms().then(function (response) {
                    $rootScope.chatrooms = response.data;
                });
            });
            //senderArray contains objects with senderId and nrOfMessages
            mySocket.on('unread messages', function (senderArray) {
                console.log("got unread message: ", senderArray);
                var unreadMessagesSenderIds = senderArray.map(x => x.senderId);
                $rootScope.unreadMessages = senderArray;
                //In case one of the users who have written to us is already selected
                //(can happen when we open the app from a push notification)
                if ($rootScope.isPrivate && unreadMessagesSenderIds.includes($rootScope.privateRecipient.id)) {
                    $rootScope.unreadMessages.splice(unreadMessagesSenderIds.indexOf($rootScope.privateRecipient.id), 1);
                }
                if ($rootScope.activeUsers) {
                    setNrOfUnreadMessages.set($rootScope.activeUsers, $rootScope.unreadMessages);
                }
                if ($rootScope.offlineConversations) {
                    setNrOfUnreadMessages.set($rootScope.offlineConversations, $rootScope.unreadMessages);
                }
            });
        }
    }
});

app.factory('stateHandler', function ($ionicScrollDelegate, $rootScope, $timeout, mySocket, messageManager, messagesPerLoad) {
    var promise;
    return {
        goIdle: function () {
            console.log("going idle");
            mySocket.emit('go idle', $rootScope.user);
            mySocket.emit('change badge', $rootScope.user.id);
            //disconnect after 30 seconds away from the app
            promise = $timeout(mySocket.disconnect, 30 * 1000);
        },
        goActive: function () {
            console.log("going active");
            $timeout.cancel(promise);
            mySocket.connect();
            mySocket.emit('connected', $rootScope.user);
            if($rootScope.privateRecipient) {
                messageManager.getPrivateMessages($rootScope.user.id, $rootScope.privateRecipient.id).then(function(res) {
                    $rootScope.messages = res.data;
                    $ionicScrollDelegate.scrollBottom();
                });
                messageManager.markReadMessages({ senderId: $rootScope.privateRecipient.id, recipientId: $rootScope.user.id });
            } else if($rootScope.selectedChatroom) {
                messageManager.getMessages($rootScope.selectedChatroom.id, null, messagesPerLoad).then(function(res) {
                    $rootScope.messages = res.data;
                    $ionicScrollDelegate.scrollBottom();
                });
            } else {
                console.log("getting messages doesnt seem to be working...");
            }
        }
    }
});

app.factory('toaster', function ($cordovaToast) {
    return {
        toast: function (message, duration, location) {
            $cordovaToast.show(message, duration, location).then(function (success) {
                console.log("The toast was shown");
            }, function (error) {
                console.log("The toast was not shown due to " + error);
            });
        }
    }
});

app.config(function ($ionicCloudProvider, $ionicConfigProvider, $stateProvider, $urlRouterProvider) {
    $stateProvider
        .state('login', {
            url: '/login',
            templateUrl: 'partials/login.html',
            controller: 'LoginController'
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
        })
        .state('signup', {
            url: '/signup',
            templateUrl: 'partials/signup.html',
            controller: 'SignupController'
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

app.controller('LeftSideController', function ($ionicScrollDelegate, $ionicSideMenuDelegate, $location, $rootScope, $scope, $timeout, messageManager, messagesPerLoad, mySocket, setNrOfUnreadMessages, toaster) {
    if (!$rootScope.user) {
        console.log("$rootScope.user is undefined, but WHYYY?!?!");
        $location.path("/");
        return;
    }
    $scope.newChatroom = {};

    messageManager.getChatrooms().then(function (response) {
        $rootScope.chatrooms = response.data;
    });

    $scope.$on("keyboardShowHideEvent", function () {
        $scope.scrollSideMenuToTop();
    });

    $timeout(function () {
        $scope.$watch(function () {
            return $ionicSideMenuDelegate.getOpenRatio();
        }, function (ratio) {
            if (ratio == 1) {
                $scope.scrollSideMenuToTop();
            }
        });
    });

    $rootScope.person = {};

    $scope.addChatroom = function () {
        messageManager.addChatroom({ "name": $scope.newChatroom.name, "user": $rootScope.user }).then(function (res) {
            toaster.toast('Chatrummet ' + $scope.newChatroom.name + ' har skapats.', 'short', 'bottom');
        }, function (res) {
            switch (res.status) {
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

    $scope.changeChatroom = function (index) {
        $rootScope.isPrivate = false;
        $rootScope.selected = index;
        $rootScope.status.moreMessages = true;
        //Leave chatroom if already in one.
        if ($rootScope.selectedChatroom) {
            mySocket.emit('leave chatroom', $rootScope.selectedChatroom.id);
        }
        $rootScope.selectedChatroom = this.chatroom;
        $rootScope.privateRecipient = undefined;
        $rootScope.selectedChatroom.id = this.chatroom._id;
        messageManager.getMessages($rootScope.selectedChatroom.id, null, messagesPerLoad).then(function (res) {
            $rootScope.messages = res.data;
        });
        mySocket.emit('join chatroom', $rootScope.selectedChatroom.id);
        $rootScope.messagesBarTitle = "#" + $rootScope.selectedChatroom.name;
    };

    $scope.hadConversation = function (userId) {
        if ($rootScope.conversations) {
            return $rootScope.conversations.map(x => x.id).includes(userId);
        }
    };

    $scope.searchUser = function () {
        if ($rootScope.person.name) {
            messageManager.getHistoricMessages($rootScope.person.name.toLowerCase()).then(function (res) {
                $rootScope.messages = res.data;
            });
            $scope.searchMode = false;
            $rootScope.privateRecipient = undefined;
            $rootScope.selectedChatroom = undefined;
            $rootScope.messagesBarTitle = $rootScope.person.name;
            $rootScope.inputMessages.showContainer = false;
        } else {
            $scope.searchMode = true;
        }
    };

    $scope.scrollSideMenuToTop = function () {
        $ionicScrollDelegate.$getByHandle('side-menu-handle').scrollTop();
    };

    $scope.showEditChatroom = function () {
        return $scope.addMode && $rootScope.user.admin;
    };

    $scope.toggleAddChatroom = function () {
        $scope.addMode = true;
    };

    $scope.toggleSearchHistory = function () {
        $scope.searchMode = true;
    };
});

app.controller('LoginController', function ($location, $rootScope, $scope, autoLoginManager, toaster, userManager) {
    //Needed on scope before login credentials are entered by user.
    $scope.login = {};

    if (autoLoginManager.currentUser()) {
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
                    name: res.data.username
                };
                if (res.data.admin) $rootScope.user.admin = true;
                autoLoginManager.addUser($rootScope.user);
                $location.path(res.data.redirect); //Redirects to /messages.
            }, function (res) {
                console.log('Login failed on server.');
                toaster.toast('Felaktiga inloggningsuppgifter!', 'long', 'bottom');
            });
        }
    };
});

app.controller('MessagesController', function ($ionicPlatform, $ionicPopup, $ionicPush, $ionicScrollDelegate, $ionicSideMenuDelegate, $location, $rootScope, $scope, autoLoginManager, messageAudio, messageManager, messagesPerLoad, mySocket, setNrOfUnreadMessages, socketEvents, stateHandler, toaster, userManager) {
    if (!$rootScope.user) {
        console.log("User not logged in! Redirecting to login.");
        $location.path('/login');
        return;
    }
    mySocket.removeAllListeners();
    mySocket.connect();
    socketEvents.set();
    //send $rootScope.user to server.js, it receives it with socket.on('connected')
    mySocket.emit('connected', $rootScope.user);
    mySocket.emit('connect message', { date: new Date(), text: $rootScope.user.name + " har loggat in." });
    if (!$rootScope.selectedChatroom && !$rootScope.privateRecipient) {
        $rootScope.selected = "591d5683f36d281c81b1e5ea";
        $rootScope.selectedChatroom = {
            id: $rootScope.selected,
            name: "general"
        }
        mySocket.emit('join chatroom', $rootScope.selectedChatroom.id);
        $rootScope.messagesBarTitle = "#general";
        $rootScope.isPrivate = false;
    }
    if ($rootScope.isPrivate) {
        messageManager.getPrivateMessages($rootScope.user.id, $rootScope.privateRecipient.id).then(function(res) {
            $rootScope.messages = res.data;
            $ionicScrollDelegate.scrollBottom();
        });
        messageManager.markReadMessages({ senderId: $rootScope.privateRecipient.id, recipientId: $rootScope.user.id }).then(function (res) {
            console.log("marked read messages");
        });
    } else {
        messageManager.getMessages($rootScope.selectedChatroom.id, null, messagesPerLoad).then(function (res) {
            $rootScope.messages = res.data;
            $ionicScrollDelegate.scrollBottom();
        });
    }

    //Register the device and get an id to be able to receive push notifications
    $ionicPush.register().then(function (t) {
        $rootScope.user.token = t.token;
        var postObj = { id: $rootScope.user.id, token: t.token };
        //Save device to user in database
        userManager.addDevice(postObj);
        return $ionicPush.saveToken(t);
    }).then(function (t) {
        //alert("Token: " + t.token);
    });

    userManager.getPicture($rootScope.user.id).then(function (res) {
        if (res.data) {
            $rootScope.user.hasImage = true;
        }
    });

    $scope.text = {};
    $scope.text.message = "";
    $rootScope.inputMessages = {};
    $rootScope.inputMessages.showContainer = true;
    $rootScope.status = {
        moreMessages: true
    };

    $scope.$on("keyboardShowHideEvent", function () {
        $ionicScrollDelegate.scrollBottom();
    });

    //goes to the right private chatroom when the app is opened from a push notification
    $scope.$on('cloud:push:notification', function (event, data) {
        if (data.message) {
            var msg = data.message;
            var recipient = { id: msg.raw.additionalData.id, name: msg.raw.additionalData.name };
            $rootScope.changeRecipient(recipient);
        }
    });

    $scope.changeRecipientFromMessage = function (message) {
        var socketId = $rootScope.activeUsers.filter(function (user) {
            if (message.senderId == user.id) return user.socketId;
        });
        $rootScope.changeRecipient({
            name: message.senderName,
            id: message.senderId,
            socketId: socketId
        });
    }

    $scope.holdOnChatroom = function (chatroom) {
        if ($rootScope.user.admin) {
            var popup = $ionicPopup.show({
                title: 'Chatrum ' + chatroom.name,
                scope: $scope,
                templateUrl: 'partials/editChatroom.html'
            });

            $scope.deleteChatroom = function () {
                messageManager.removeChatroom({ "chatroomId": chatroom._id, "userId": $rootScope.user.id }).then(function (res) {
                    switch (res.status) {
                        case 200:
                            toaster.toast(chatroom.name + ' togs bort.', 'short', 'bottom');
                            break;
                        case 500:
                            toaster.toast('Databasfel: 500', 'short', 'bottom');
                            break;
                        case 401:
                            toaster.toast('Du måste vara admin för detta.', 'short', 'bottom');
                            break;
                        default:
                            toaster.toast('Okänt fel.', 'short', 'bottom');
                    }
                });
                popup.close();
            };

            $scope.closeChatroomPopup = function () {
                popup.close();
            }
        }
    }

    $scope.holdOnMessage = function (message) {
        if ($rootScope.user.id == message.senderId) {
            $scope.editMessage = {
                text: message.text
            };

            var popup = $ionicPopup.show({
                title: 'Meddelande',
                scope: $scope,
                templateUrl: 'partials/editMessage.html'
            });

            $scope.saveMessage = function (updatedMessage) {
                if (updatedMessage) {
                    message.text = updatedMessage;
                    messageManager.updateMessage(message);
                    popup.close();
                } else {
                    console.log('Texten uppfyller inte kraven för att posta.')
                    toaster.toast('Texten uppfyller inte kraven för att posta.', 'short', 'bottom');
                }
            };

            $scope.cancelMessage = function () {
                popup.close();
            };
        }
    };

    $scope.lessThanTwenty = function () {
        if ($rootScope.messages) {
            return $rootScope.messages.length < messagesPerLoad;
        }
        return true;
    };

    $scope.loadMoreMessages = function () {
        console.log($rootScope.messages);
        var lastMessage = $rootScope.messages.reduce(function (a, b) { return a.timestamp < b.timestamp ? a : b; });
        console.log(lastMessage._id);

        messageManager.getMessages($rootScope.selectedChatroom.id, lastMessage._id, messagesPerLoad).then(function (res) {
            $scope.doScrollTop = true;
            console.log(res.data.length);
            $rootScope.status.moreMessages = (res.data.length >= messagesPerLoad) ? true : false;
            $rootScope.messages = $rootScope.messages.concat(res.data);
        });
    };

    $scope.onHold = function (targetUser) {
        if ($rootScope.user.admin) {
            var popup = $ionicPopup.show({
                title: 'Vad vill du göra med ' + targetUser.name + '?',
                scope: $scope,
                templateUrl: 'partials/editUser.html'
            });

            $scope.deleteUser = function () {
                userManager.removeUser({
                    "userId": $rootScope.user.id,
                    "removeUserId": targetUser.id
                }).then(function (res) {
                    if (res.status == 200) {
                        console.log(targetUser.name + " deleted!");
                        toaster.toast(targetUser.name + ' är nu bortagen!', 'long', 'bottom');
                    }
                }, function (res) {
                    switch (res.status) {
                        case 400:
                            console.log("User is not authorised to delete users.");
                            toaster.toast('Du måste vara admin för att ta bort användare.', 'short', 'bottom');
                            break;
                        case 500:
                            console.log("Database error: User not found.");
                            toaster.toast('Databasfel: Användaren kunde inte raderas.', 'short', 'bottom');
                            break;
                        default:
                            console.log("Unknown error.");
                            toaster.toast('Okänt fel.', 'short', 'bottom');
                    }
                });
                popup.close();
            }

            $scope.closePopup = function () {
                console.log("Admin cancelled user edit.");
                popup.close()
            }
        }
    }

    $scope.postMessage = function () {
        var newMessage = {
            "senderId": $rootScope.user.id,
            "senderName": $rootScope.user.name,
            "hasImage": $rootScope.user.hasImage,
            "text": $scope.text.message,
            "chatroom": $rootScope.selectedChatroom.id
        };
        console.log(newMessage);
        if ($rootScope.user.admin) newMessage.admin = true;
        //Send message to the current chatroom
        if (newMessage.text != "") {
            messageManager.postMessages(newMessage).then(function(res) {
              console.log(res.data);
              mySocket.emit('chatroom message', res.data);
            });
            $scope.text.message = "";
            $ionicScrollDelegate.scrollBottom();
        } else {
            toaster.toast('Du kan inte skicka ett tomt meddelande. ', 'short', 'bottom');
        }
        return false;
    };

    $scope.postPrivateMessage = function () {
        var newPrivateMessage = {
            "senderId": $rootScope.user.id,
            "senderName": $rootScope.user.name,
            "hasImage": $rootScope.user.hasImage,
            "text": $scope.text.message,
            "recipientId": $rootScope.privateRecipient.id,
            "recipientName": $rootScope.privateRecipient.name,
            "unread": true
        };
        if ($rootScope.user.admin) newPrivateMessage.admin = true;
        //Send a direct private message.
        if (newPrivateMessage.text != "") {
            //Post the message to the database
            messageManager.postPrivateMessage(newPrivateMessage);
            mySocket.emit('private message', newPrivateMessage);
            $scope.text.message = "";
            $ionicScrollDelegate.scrollBottom();
        } else {
            toaster.toast('Du kan inte skicka ett tomt meddelande. ', 'short', 'bottom');
        }
    };

    $scope.showLoadMoreMessages = function () {
        if ($scope.lessThanTwenty()) return false;
        return $rootScope.status.moreMessages;
    }

    // Toggle show/hide input message container. We want to hide the container
    // after making a search, and show it again when menu-toggle button is pressed.
    $scope.toggleMessageInputContainer = function () {
        $rootScope.inputMessages.showContainer = true;
    };

    $rootScope.changeRecipient = function changeRecipient(recipient) {
        if (!$rootScope.user) {
            console.log("User not logged in! Redirecting to login.");
            $location.path('/');
            return;
        }
        $rootScope.isPrivate = true;
        $rootScope.selected = recipient.id;
        $rootScope.privateRecipient = recipient;
        if ($rootScope.selectedChatroom) {
            mySocket.emit('leave chatroom', $rootScope.selectedChatroom.id);
            $rootScope.selectedChatroom = undefined;
        }
        var barTitle = $rootScope.privateRecipient.name;
        if ($rootScope.privateRecipient.id == $rootScope.user.id) {
            barTitle += " (du)";
        }
        $rootScope.messagesBarTitle = barTitle;
        $location.path('/messages');
        messageManager.getPrivateMessages($rootScope.user.id, $rootScope.privateRecipient.id).then(function (res) {
            $rootScope.messages = res.data;
            $ionicScrollDelegate.scrollBottom();
        });
        messageManager.markReadMessages({ senderId: $rootScope.privateRecipient.id, recipientId: $rootScope.user.id }).then(function (res) {
            console.log("marked read messages");
        });
        var unreadMessagesSenderIds = $rootScope.unreadMessages.map(x => x.senderId);
        if (unreadMessagesSenderIds.includes(recipient.id)) {
            $rootScope.unreadMessages.splice(unreadMessagesSenderIds.indexOf(recipient.id), 1);
            setNrOfUnreadMessages.set($rootScope.activeUsers, $rootScope.unreadMessages);
            console.log("I changerecipient, activeUsers: " + $rootScope.activeUsers.map(x => JSON.stringify(x)).toString());
            setNrOfUnreadMessages.set($rootScope.offlineConversations, $rootScope.unreadMessages);
            console.log("I changerecipient, offlineConversations: " + $rootScope.offlineConversations.map(x => JSON.stringify(x)).toString());
        }
    };

    $rootScope.getMessageImage = function (message) {
        userManager.getPicture(message.senderId).then(function (res) {
            message.senderImage = res.data;
        });
    };

    $rootScope.toggleLeft = function () {
        $ionicSideMenuDelegate.toggleLeft();
    };

    $rootScope.$watch('messages', function () {
        if (!$rootScope.messages || $rootScope.messages.length <= 0) {
            $scope.noMessages = true;
        } else {
            $scope.noMessages = false;
            if ($scope.doScrollTop) {
                $ionicScrollDelegate.scrollTop();
                $scope.doScrollTop = false;
            } else {
                $ionicScrollDelegate.scrollBottom();
            }
        }
    }, true);

    $rootScope.$watchGroup(['privateRecipient', 'selectedChatroom', 'activeUsers'], function() {
        if($rootScope.privateRecipient) {
            var activeUserIds = $rootScope.activeUsers.map(a=>a.id);
            if(activeUserIds.includes($rootScope.privateRecipient.id)) {
                $scope.isRecipientIdle = $rootScope.activeUsers[activeUserIds.indexOf($rootScope.privateRecipient.id)].isIdle ? "(idle)" : "";
                $scope.isRecipientOffline = "";
            } else {
                $scope.isRecipientOffline = "(offline)";
                $scope.isRecipientIdle = "";
            }
        } else {
            $scope.isRecipientOffline = "";
            $scope.isRecipientIdle = "";
        }
    });
});

app.controller('SettingsController', function ($cordovaFile, $location, $rootScope, $scope, autoLoginManager, mySocket, toaster, userManager) {
    $scope.changeUsername = function (newUsername) {
        if (newUsername) {
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
            mySocket.emit('change username', { "id": $rootScope.user.id, "newUserName": newUsername });
        } else {
            var message = "Du måste välja ett användarnamn som innehåller minst tre tecken och max 20 tecken." +
                "\nDu kan inte använda speciella tecken, endast siffror och bokstäver(a-z).";
            toaster.toast(message, 'long', 'bottom');
        }
    };

    $scope.getSettingsImage = function (user) {
        userManager.getPicture(user.id).then(function (res) {
            user.image = res.data;
        });
    };

    $scope.goBackToMessages = function () {
        $location.path("/messages");
    };

    $scope.logout = function () {
        var userId = $rootScope.user.id;
        var token = $rootScope.user.token;
        userManager.removeDevice({ id: userId, token: token });
        mySocket.emit('go idle', $rootScope.user);
        $rootScope.user = {};
        $rootScope.selected = undefined;
        $rootScope.selectedChatroom = undefined;
        $rootScope.privateRecipient = undefined;
        $rootScope.conversations = undefined;
        $rootScope.unreadMessages = undefined;
        $rootScope.offlineConversations = undefined;
        $rootScope.activeUsers = undefined;
        $rootScope.messages = undefined;
        mySocket.disconnect();
        autoLoginManager.removeUser();
        $location.path('/login');
    };

    $scope.takePicture = function () {
        navigator.camera.getPicture(onPhotoSuccess, onFail, {
            quality: 50, encodingType: Camera.EncodingType.JPEG,
            destinationType: Camera.DestinationType.DATA_URL, sourceType: Camera.PictureSourceType.CAMERA, targetWidth: 200,
            targetHeight: 200, allowEdit: true, popoverOptions: CameraPopoverOptions, saveToPhotoAlbum: false, cameraDirection: 1
        });

        function onPhotoSuccess(imageData) {
            var image = "data:image/jpeg;base64," + imageData;
            userManager.uploadPicture({ "image": image, "user": $rootScope.user.id }).then(function () {
                $scope.getSettingsImage($rootScope.user);
            });
            $rootScope.user.hasImage = true;
            toaster.toast("Din bild har sparats.", 'short', 'bottom');
        }

        function onFail(message) {
            console.log("Kunde inte ladda in bilden: " + message);
            toaster.toast("Kunde inte spara din bild.", 'long', 'bottom');
        }
    };
});

app.controller('SignupController', function ($location, $rootScope, $scope, toaster, userManager) {
    $scope.userSignup = function (signup) {
        if (signup === undefined || signup.email === undefined || signup.username === undefined || signup.password === undefined || signup.passwordagain === undefined) {
            var message = "";
            if (signup.username === undefined) message += "Du måste välja ett användarnamn som innehåller minst tre tecken och max 20 tecken." +
                "\nDu kan inte använda speciella tecken, endast siffror och bokstäver(a-z).";
            if (signup.email === undefined) {
                if (message.length > 0) message += "\n";
                message += "Felaktig emailadress.";
            };
            if (signup.password === undefined) {
                if (message.length > 0) message += "\n";
                message += "Du måste välja ett lösenord som innehåller minst sex tecken och max 50 tecken.";
            };
            toaster.toast(message, 'long', 'bottom');
        } else if (signup.password !== signup.passwordagain) {
            toaster.toast('Du skrev in lösenordet olika i de två fälten.', 'long', 'bottom');
        } else {
            userManager.signupuser({
                username: signup.username,
                email: signup.email,
                password: signup.password
            }).then(function (res) { //Successful codes 100-399.
                console.log("Signup OK. Redirecting to login.");
                $location.path(res.data.redirect);
                toaster.toast("Användare registrerad.", "long", "bottom");
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
