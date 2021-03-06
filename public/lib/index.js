var lib = angular.module('lib', []);
//var serverUrl = 'http://localhost:3000';
//var serverUrl = 'http://shutapp.nu:3000';
//var serverUrl = 'http://192.168.1.xx:3000';
var serverUrl = 'http://172.104.137.232:3000';

lib.factory('userManager', function ($http) {
    var userManager = {};
    userManager.login = function (username, password) {
        return $http.get(serverUrl + '/login/' + username + '/' + password);
    };
    userManager.logout = function () {
        return $http.get(serverUrl + '/logout');
    };
    userManager.signupuser = function (signupCredentials) {
        return $http.post(serverUrl + '/signup', signupCredentials);
    };
    userManager.updateUsername = function (newUsername) {
        return $http.post(serverUrl + '/users/update', newUsername);
    };
    userManager.addDevice = function (deviceObj) {
        return $http.post(serverUrl + '/device', deviceObj);
    };
    userManager.removeDevice = function (deviceObj) {
        return $http.post(serverUrl + '/removedevice', deviceObj);
    };
    userManager.removeUser = function (user) {
        return $http.post(serverUrl + '/users/remove', user);
    };
    userManager.uploadPicture = function(userAndImage) {
        return $http.post(serverUrl + '/upload', userAndImage);
    };
    userManager.getPicture = function(userId) {
        return $http.get(serverUrl + '/picture/' + userId);
    };
    return userManager;
});

lib.factory('messageManager', function ($http) {
    var messageManager = {};
    messageManager.getChatrooms = function () {
        return $http.get(serverUrl + '/chatrooms');
    };
    messageManager.addChatroom = function (newChatroom) {
        return $http.post(serverUrl + '/chatrooms/add', newChatroom);
    };
    messageManager.removeChatroom = function (chatroomId) {
        return $http.post(serverUrl +  '/chatrooms/remove', chatroomId);
    };
    messageManager.getMessages = function (chatroomId, lastMessageId, numberOfMessages) {
      var request = serverUrl + '/messages?chatroom=' + chatroomId;
        if(lastMessageId) {
          request += '&lastMessageId=' + lastMessageId;
        }
        if(numberOfMessages) {
          request += '&numberOfMessages=' + numberOfMessages;
        }
        return $http.get(request);
    };
    messageManager.getPrivateMessages = function (user, otheruser) {
        return $http.get(serverUrl + '/messages?user=' + user + '&otheruser=' + otheruser);
    };
    messageManager.getConversations = function (userId) {
        return $http.get(serverUrl + '/conversations?userid=' + userId);
    };
    messageManager.postMessages = function (newMessage) {
        return $http.post(serverUrl + '/messages', newMessage);
    };
    messageManager.postPrivateMessage = function (newPrivateMessage) {
        return $http.post(serverUrl + '/private-message', newPrivateMessage);
    };
    messageManager.markReadMessages = function (senderIdObj) {
        return $http.post(serverUrl + '/mark-read-messages', senderIdObj);
    };
    messageManager.getHistoricMessages = function (user) {
        return $http.get(serverUrl + '/searchUserMessages?userName=' + user);
	};
    messageManager.updateMessage = function (message) {
        return $http.post(serverUrl + '/messages/update', message);
    };
    return messageManager;
});
