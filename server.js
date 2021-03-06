var express = require('express');
var mongo = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;
var bodyParser = require('body-parser');
var session = require('express-session');
var MongoStore = require('connect-mongo')(session);
var multer  = require('multer')
var bcrypt = require('bcrypt');
var cors = require('cors');
var gcm = require('node-gcm');
var fs = require('fs');
const saltRounds = 10;

var app = express();

var http = require('http').Server(app);
var io = require('socket.io')(http);

var activeUsers = [];

var port = 3000;
var db;

var filename;

//push notifications
var sender = new gcm.Sender('AAAALZ3KnzQ:APA91bEqXgPxY2rQAE8G78hqauB-bo3gdHRKzcOZsx5_1WLfjcAUdnz94z9ol9jwNelj1oc_gHJeOsDtYk-cvVxcDh-FQejjid1uD4xZwSD10T6MjNGcERG6ydft6wQWS6VrzRggYTH4');

app.use(bodyParser.json({limit: '5mb', extended: true}));
app.use(bodyParser.urlencoded({limit: '5mb', extended: true}));
app.use(express.static(__dirname + '/public'));
app.use(cors());

// Store profile picture on disc, specify path
var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, __dirname + '/uploads')
    },
    filename: function (req, file, cb) {
        cb(null, createProfilePictureFileName(file.originalname, req.body.userid))
    }
})
var upload = multer({ storage: storage })

mongo.connect('mongodb://shutapp:shutapp123@ds133981.mlab.com:33981/shutapp', function(err, database) {
    if (err) {
        console.log(err);
    }
    db = database;

    db.collection('users').createIndex(
        { username: 1 },
        { unique:true },
        function(err, result) {
            //Adds unique index for username.
        }
    );

    db.collection('users').createIndex(
        { email: 1 },
        { unique:true },
        function(err, result) {
            //Adds unique index for email.
        }
    );
});

app.use(session({
    secret: 'please shutapp',
    resave: true,
    saveUninitialized: false,
    store: new MongoStore({url: 'mongodb://shutapp:shutapp123@ds133981.mlab.com:33981/shutapp'})
}));

app.post('/messages', function(req, res) {
    var newMessage = req.body;
    newMessage.timestamp = new Date();
    db.collection('chatMessages').insertOne(newMessage).then(function(result) {
        //201 is a "created" status code
        if(result) {
            res.status(201).send(result.ops[0]);
        } else {
            res.status(400).send();
        }
    });
});

app.post('/messages/update', function(req, res) {
    var message = req.body;
    var chatroom = (message.recipientId) ? 'privateMessages' : 'chatMessages';
    db.collection(chatroom).updateOne({"_id": ObjectID(message._id)}, { $set: {"text": message.text, "edited": true}}).then(function(cb) {
        if(cb.result.nModified == 1) {
            console.log('message updated.');
            io.to(message.chatroom).emit('edited message');
            res.status(201).send();
        } else {
            console.log('message text not changed.');
            res.status(400).send();
        }
    });
});

//Denna hette tidigare private-messages
app.post('/private-message', function(req, res) {
    var newPrivateMessage = req.body;
    newPrivateMessage.timestamp = new Date();
    db.collection('privateMessages').insert(newPrivateMessage).then(function(result) {
        //201 is a "created" status code
        if(result) {
            res.status(201).send({});
        } else {
            res.status(400).send({});
        }
    });
});

app.post('/mark-read-messages', function(req, res) {
    console.log("marking message as read");
    var senderId = req.body.senderId;
    var recipientId = req.body.recipientId;
    db.collection('privateMessages').updateMany({"recipientId": recipientId, "senderId": senderId}, { $set: {"unread": false}}).then(function(doc) {
        console.log("marked messages as read");
        res.status(200).send({});
    });
});

app.get('/messages', function(req, res) {
    var findObject = {};
    if(req.query.user) {
        var collection = 'privateMessages';
        var user = req.query.user;
        var otherUser = req.query.otheruser;
        findObject = {$or: [ {senderId: user, recipientId: otherUser}, {senderId: otherUser, recipientId: user} ] };
    } else {
        var collection = 'chatMessages';
        findObject = {"chatroom": req.query.chatroom};
        if(req.query.lastMessageId) {
          var id = ObjectID(req.query.lastMessageId);
          findObject._id = {"$lt": id};
        }
    }

    var pageSize = req.query.numberOfMessages ? Number(req.query.numberOfMessages) : 0;
    db.collection(collection).find(findObject).sort([['_id', -1]]).limit(pageSize).toArray(function(err, result) {
        if(err) {
            res.status(500).send({});
        }
        res.status(200).send(result);
    });
});

// Save users profile picture on disc. See multer.discStorage
/*app.post('/upload', upload.single('avatar'), function (req, res, next) {
    //save file path to user collection in database
    db.collection('users').findOneAndUpdate(
        {"_id": ObjectID(req.body.userid) },
        { $set: {"picturePath": "/uploads/" + createProfilePictureFileName(req.file.originalname, req.body.userid)}
    }).then(function() {
        res.status(201).send();
    });
    res.status(200).send();
});*/

//Get list of users with which we have had a conversation
app.get('/conversations', function(req, res) {
    var userId = req.query.userid;
    var conversationUsers = [];
    var collectionCounter = 0;
    db.collection('users').count().then(function(collectionSize) {
        db.collection('users').find().forEach(function(otherUser) {
            var otherUserId = otherUser._id.toString();
            db.collection('privateMessages').findOne({$or: [{ "senderId": userId, "recipientId": otherUserId }, { "senderId": otherUserId, "recipientId": userId }] }).then(function(obj) {
                collectionCounter++;
                if(obj) {
                    conversationUsers.push({id: otherUserId, name: otherUser.username});
                }
                if(collectionCounter == collectionSize) {
                    res.status(200).send(conversationUsers);
                }
            });
        }, function(err) {
            console.log("conversation error? ", err);
        });
    });
});


app.get('/chatrooms', function(req, res) {
    //find all chatrooms and add these to a list
    db.collection('chatrooms').find().toArray(function (error, result){
        if(error) {
            res.status(500).send(error);
            return;
        }
        //result is an array with chatroom objects
        res.status(200).send(result);
    });
});

//Returns true or false depending on account admin propery.
function isAdmin(userId) {
    return db.collection('users').find({"admin": true}).toArray().then(function(docs) {
        return docs.find(function(user) {
            return user._id == userId;
        }) ? true : false;
    });
};

app.post('/users/remove', function(req, res) {
    isAdmin(req.body.userId).then(function(admin) {
        if(admin) {
            var id = ObjectID(req.body.removeUserId);
            db.collection('users').findOneAndDelete({"_id": id}).then(function(cb) {
                if(cb.value) {
                    for(var i = 0; i < activeUsers.length; i++) {
                        if(activeUsers[i].id == req.body.removeUserId) {
                            io.to(activeUsers[i].socketId).emit('banned');
                            activeUsers.splice(i, 1);
                        };
                    };
                    io.emit('active users', activeUsers);
                    console.log('user removed!');
                    res.status(200).send();
                } else {
                    console.log('user not removed!');
                    res.status(500).send();
                }
            });
        } else {
            console.log('not admin!');
            res.status(401).send();
        }
    });
});

app.post('/chatrooms/remove', function(req, res) {
    isAdmin(req.body.userId).then(function(admin) {
        if(admin) {
            var id = ObjectID(req.body.chatroomId);
            db.collection('chatrooms').findOneAndDelete({"_id": id}).then(function(cb) {
                if(cb.value) {
                    io.emit('refresh chatroom');
                    console.log('Removed room ' + id);
                    res.status(200).send();
                } else {
                    console.log('Failed to remove room ' + id);
                    res.status(500).send();
                }
            });
        } else {
            res.status(401).send();
        }
    });
});

app.post('/upload', function(req, res) {
    var image = req.body.image;
    var userId = req.body.user;
    var base64 = image.replace(/^data:image\/jpeg;base64,/, "");

    fs.writeFile(__dirname + "/uploads/" + userId + ".jpg", base64, 'base64', function(err) {
        console.log(err);
    });
    res.status(200).send();
});

app.get('/picture/:userId', function(req, res) {
    var filePath = __dirname + "/uploads/" + req.params.userId + ".jpg";
    var base64 = fileToBase64(filePath);

    function fileToBase64(file) {
        // read binary data
        var image = fs.readFileSync(file);
        // convert binary data to base64 encoded string
        return new Buffer(image).toString('base64');
    }

    res.status(200).send("data:image/jpeg;base64," + base64);
});

app.post('/chatrooms/add', function(req, res) {
    if(req.body.name === undefined || req.body.name.length < 3 || req.body.name.length > 15) return res.status(406).send();
    var roomName = req.body.name.toLowerCase();
    isAdmin(req.body.user.id).then(function(admin) {
      if(admin) {
        db.collection('chatrooms').count({"name": roomName}).then(function(error, result) {
            if(!error) {
                db.collection('chatrooms').insertOne({"name": roomName, "users": []}).then(function(cb) {
                    if(cb.result.ok > 0) {
                        io.emit('refresh chatroom');
                        res.status(201).send();
                    } else {
                        res.status(500).send();
                    }
                });
            } else {
                res.status(400).send();
            }
        });
      } else {
        res.status(406).send();
      }
    });
});

app.get('/searchUserMessages', function(req, res) {
    var userName = req.query.userName;

    // Find chatroom messages
    db.collection('chatMessages').find({"senderName": userName}, {"timestamp": 1, "text": 1, "senderName": 1, "_id": 0, "hasImage": 1}).toArray(function(err, chatMessages) {
        if(err) {
            res.status(500).send({});
            return;
        }
        res.status(200).send(chatMessages);
    });
});

app.post('/signup', function(req, res) {
    //All usernames are stored as lowercase for simplicity.
    var username = req.body.username.toLowerCase();
    var email = req.body.email.toLowerCase();
    var password = req.body.password;
    if(!email.match(/^[a-zA-Z0-9.!#$%&’*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/)
    || !username.match(/[0-9a-zA-Z]{3,20}/)
    || !password.match(/^.{6,50}$/) ) {
        res.status(400).send({}); //"Bad request"
        return;
    }
    //Hashing password and adding user to database.
    bcrypt.hash(req.body.password, saltRounds, function(err, hash) {
        if (err) {
            console.log("Signup-error: Hashing password failed.");
            res.status(500).send({}); //"Internal server error."
        } else {
            db.collection('users').insertOne({username: username, email: email, password: hash})
            .then(function(result) {
                console.log("Signup successful. Added user: " + username);
                res.status(201).send({redirect:'/'}); //Must use res-object from post NOT result from db insert.
            }, function(error) {
                if (error.errmsg.includes("$email")) {
                    console.log("Signup-error: Email already in use.");
                    res.status(409).send({"reason":"email"});
                } else if (error.errmsg.includes("$username")) {
                    console.log("Signup-error: Username already in use.");
                    res.status(409).send({"reason":"username"});
                }
            });
        }
    });
});

app.get('/logout', function(req, res, next) {
    if(req.session) {
        req.session.destroy();
    }
});

app.post('/users/update', function (req, res) {
    var id = req.body.id;
    var newUsername = req.body.username.toLowerCase();

    if (!newUsername.match(/[0-9a-zA-Z]{3,20}/)) res.status(400).send({});

    db.collection('users').findOneAndUpdate({"_id": ObjectID(id) }, { $set: {"username": newUsername}})
    .then(function(result) {
        console.log('Updated username for user with id: ' + id + " to " + newUsername );
        updateMessages();
        res.status(200).send({});
    }, function(error) {
        console.log('Failed to update username for user with id: ' + id);
        res.status(400).send({});
    });

    //Updates all messages in the database with the new username.
    updateMessages = function() {
        console.log('Updating database messages for user: ' + id);
        db.collection('privateMessages').updateMany({"senderId": id }, { $set: {"senderName": newUsername}}).then(function(doc) {
            console.log('Found:' + doc.matchedCount, 'Modified:' + doc.modifiedCount);
        });
        db.collection('privateMessages').updateMany({"recipientId": id }, { $set: {"recipientName": newUsername}}).then(function(doc) {
            console.log('Found:' + doc.matchedCount, 'Modified:' + doc.modifiedCount);
        });
        db.collection('chatMessages').updateMany({"senderId": id }, { $set: {"senderName": newUsername}}).then(function(doc) {
            console.log('Found:' + doc.matchedCount, 'Modified:' + doc.modifiedCount);
        });
        for(var i = 0; i < activeUsers.length; i++) {
            if(activeUsers[i].id == id) {
                console.log('Changed username in activeUsers.');
                activeUsers[i].name = newUsername;
                io.emit('active users', activeUsers);
            }
        }
    };
});

app.post('/device', function(req, res) {
    //This is run at login. Add device to database
    db.collection('users').update({"_id": ObjectID(req.body.id)}, {$addToSet: {"devices": req.body.token}}).then(function(doc) {
        console.log("registered a device: " +  req.body.token);
    });
});

app.post('/removedevice', function(req, res) {
    //This is run at logout. Remove device from database
    db.collection('users').update({"_id": ObjectID(req.body.id)}, {$pull: {"devices": req.body.token}}).then(function(doc) {
        console.log("removed a device");
    });
});

app.get('/login/:username/:password', function (req, res) {
    db.collection('users').findOne({username: req.params.username.toLowerCase()}, function(err, user) {
        if(err) {
            console.log('Loginrequest caused database error.');
            res.status(500).send(err);
        } else if(user === null) {
            console.log('Loginrequest with invalid username.');
            res.status(401).send({});
        } else if(!bcrypt.compareSync(req.params.password, user.password)) {
            console.log('Loginrequest with invalid password.');
            res.status(401).send({});
        } else if(bcrypt.compareSync(req.params.password, user.password)) {
            console.log('Loginrequest for ' + user.username + ' successful.');
            //Adds the userID to the session for the server to track.
            req.session.userId = user._id;
            var loginObj = {
                _id: user._id,
                username: user.username,
                redirect: 'messages'
            };
            if(user.admin) loginObj.admin = true;
            res.status(200).send(loginObj);
        } else {
            console.log("Some other error...");
        }
    });
});

io.on('connection', function(socket){
    socket.on('connected', function(user) {
        socket.username = user.name;
        console.log(socket.username + " has connected.");
        var isInList = false;
        for (var i = 0; i < activeUsers.length; i++)  {
            if (user.id == activeUsers[i].id) {
                isInList = true;
                activeUsers[i].isIdle = false;
            }
        }
        if (!isInList) activeUsers.push({ name: socket.username, id: user.id, socketId: socket.id, isIdle: false });
        io.emit('active users', activeUsers);
        db.collection('privateMessages').find({"recipientId": user.id, "unread": true}, {"senderId": 1}).toArray(function(err, result) {
            console.log("i server.js, err unread messages: ", err);
            console.log("i server.js, resultat unread messages: ", result)
            var uniqueArray = [];
            var resultIds = result.map(x=>x.senderId);
            for(var i=0; i<resultIds.length; i++) {
                if(resultIds.indexOf(resultIds[i]) == i) {
                    uniqueArray.push(resultIds[i]);
                }
            }
            var finalResult = [];
            for(var i=0; i<uniqueArray.length; i++) {
                var counter = 0;
                for(var j=0; j<resultIds.length; j++) {
                    if(uniqueArray[i] == resultIds[j]) {
                        counter++;
                    }
                }
                finalResult.push({
                    senderId: uniqueArray[i],
                    nrOfMessages: counter
                });
            }
            socket.emit('unread messages', finalResult);
        });
    });
    socket.on('go idle', function(user) {
        console.log(user.name + " going idle");
        var index = activeUsers.findIndex(function(activeUser) {
            return activeUser.id === user.id;
        });
        if(index >= 0) {
            activeUsers[index].isIdle = true;
            io.emit('active users', activeUsers);
        }
    });
    socket.on('private message', function(message){
        message.timestamp = new Date();
        //Gets correct socketId for recipient.
        var index = activeUsers.findIndex(function(activeUser) {
            return activeUser.id === message.recipientId;
        });
        if(index >= 0 && !activeUsers[index].isIdle) {
            //Send to the other person
            socket.to(activeUsers[index].socketId).emit('private message', message);
        } else {
            //Prepare notification
            //Ugly hack to make sure the latest message has been posted to the database
            setTimeout(sendPushNotification, 300);
            var notid = parseInt(message.senderId, 16) % 2147483647; //2147483647 is max int in Java
            var vibrationPattern = [];
            if(message.text == "Leif") {
                    vibrationPattern = [0, 500, 100, 200, 100, 200, 100, 500, 100, 500, 600, 500, 100, 600];
            } else {
                var vibrationLength = Math.min(3000, 200 + message.text.length * 50);
                vibrationPattern = [0, vibrationLength];
            }
            function sendPushNotification() {
                db.collection('privateMessages').find({"recipientId": message.recipientId, "unread": true}).count().then(function(nrOfUnread) {
                    var pushNotification = new gcm.Message({
                        //"collapseKey": message.senderId,
                        "data": {
                            "title": "ShutApp",
                            "body": message.senderName + " skriver: " + message.text,
                            "id": message.senderId,
                            "name": message.senderName,
                            "notId": notid,
                            "badge": nrOfUnread,
                            "vibrationPattern": vibrationPattern
                        }
                    });
                    //get regTokens from database
                    db.collection('users').findOne({"_id": ObjectID(message.recipientId)},{"devices": 1}).then(function(obj) {
                        var regTokens = obj.devices;
                        //Send the notification
                        if(regTokens) {
                            sender.send(pushNotification, { registrationTokens: regTokens }, function (err, response) {
                                if (err) console.error("error: ", err);
                            });
                        }
                    });
                });
            }
        }
        //Send to myself
        socket.emit('private message', message);
    });
    //This will send an invisible push notification, just to change the badge number on the app icon
    socket.on('change badge', function(userId) {
        db.collection('privateMessages').find({"recipientId": userId, "unread": true}).count().then(function(nrOfUnread) {
            var pushNotification = new gcm.Message({
                "data": {
                    "badge": nrOfUnread
                }
            });
            db.collection('users').findOne({"_id": ObjectID(userId)},{"devices": 1}).then(function(obj) {
                var regTokens = obj.devices;
                //Send the notification
                if(regTokens) {
                    sender.send(pushNotification, { registrationTokens: regTokens }, function (err, response) {
                        console.log("sending push notification to change badge");
                        if (err) console.error("error: ", err);
                    });
                }
            });
        });
    });
    socket.on('connect message', function(message) {
        socket.broadcast.emit('connect message', message);
    });
    socket.on('disconnect message', function(message) {
        io.emit('disconnect message', message);
    });
    socket.on('disconnect', function() {
        if (activeUsers.findIndex(function(obj) {return obj.name === socket.username;}) != -1) {
            activeUsers.splice(activeUsers.findIndex(function(obj) {
                console.log(socket.username + " has disconnected.");
                return obj.name === socket.username;
            }), 1);
            socket.broadcast.emit('active users', activeUsers);
            socket.broadcast.emit('disconnect message', {timestamp: new Date(), text: socket.username + " har loggat ut."});
        }
    });
    socket.on('join chatroom', function(chatroomId) {
        socket.join(chatroomId, function() {

        });
        socket.emit('join chatroom');
    });
    socket.on('chatroom message', function(message) {
        message.timestamp = new Date();
        io.in(message.chatroom).emit('chatroom message', message);
    });
    socket.on('leave chatroom', function(chatroomId) {
        socket.leave(chatroomId);
    });
    socket.on('change username', function(obj) {
        io.emit('change username', obj);
    });
});

http.listen(port, function(){
    console.log('Listening on: ' + port);
});

function createProfilePictureFileName(originalFileName, userId){
    var fileExtension = originalFileName.split(".")[1];
    return userId + '.' + fileExtension;
}
