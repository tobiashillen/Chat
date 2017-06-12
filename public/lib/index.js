var lib = angular.module('lib', []);

lib.factory('userManager', function ($http) {
    var userManager = {};
    userManager.login = function (username, password) {
        return $http.get('http://localhost:3000/login/' + username + '/' + password);
    };
    userManager.logout = function () {
        return $http.get('http://localhost:3000/logout');
    };
    userManager.signupuser = function (signupCredentials) {
        return $http.post('http://localhost:3000/signup', signupCredentials);
    };
    userManager.updateUsername = function (newUsername) {
        return $http.post('http://localhost:3000/users/update', newUsername);
    };
    userManager.addDevice = function (deviceObj) {
        return $http.post('http://localhost:3000/device', deviceObj);
    };
    userManager.removeDevice = function (deviceObj) {
        return $http.post('http://localhost:3000/removedevice', deviceObj);
    };
    return userManager;
});

lib.factory('messageManager', function ($http) {
    var messageManager = {};
    messageManager.getChatrooms = function () {
        return $http.get('http://localhost:3000/chatrooms');
    };
    messageManager.addChatroom = function (newChatroom) {
        return $http.post('http://localhost:3000/chatrooms/add', newChatroom);
    };
    messageManager.getMessages = function (chatroomId) {
        return $http.get('http://localhost:3000/messages?chatroom=' + chatroomId);
    };
    messageManager.getPrivateMessages = function (user, otheruser) {
        return $http.get('http://localhost:3000/messages?user=' + user + '&otheruser=' + otheruser);
    };
    messageManager.getConversations = function (userId) {
        return $http.get('http://localhost:3000/conversations?userid=' + userId);
    };
    messageManager.postMessages = function (newMessage) {
        return $http.post('http://localhost:3000/messages', newMessage);
    };
    messageManager.postPrivateMessage = function (newPrivateMessage) {
        return $http.post('http://localhost:3000/private-messages', newPrivateMessage);
    };
    return messageManager;
});
