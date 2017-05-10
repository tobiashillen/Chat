var express = require('express');
var mongo = require('mongodb').MongoClient;
var bodyParser = require('body-parser');

var app = express();

var port = 3000;
var db;

app.use(bodyParser.urlencoded({extended: true}));

mongo.connect('mongodb://shutapp:shutapp123@ds133981.mlab.com:33981/shutapp', function(err, database) {
    if (err) {
        console.log(err);
    }
    db = database;
});

app.post('/messages', function(req, res) {
    db.collection('users').save(req.body, function(err, result) {
        if (err) {
            console.log(err);
        }
        console.log("Saved to database.");
        res.redirect('/messages');
    })
});

app.use(express.static(__dirname + '/public'));

//Mock data with users.
var users = require('./mock/users.json');
//GET handler for users.
var activeUsers = [{
    name: "Harry"
}];
app.get('/activeUsers', function (req, res) {
    res.send(activeUsers);
});
app.get('/login/:name', function (req, res) {
    console.log('hej');
    var name = req.params.name;
    var isActive = false;
    for(var i = 0; i < activeUsers.length; i++) {
        if (activeUsers[i].name.toUpperCase() == name.toUpperCase()) isActive = true;
    }
    if(!isActive) {
        console.log('i should redirect');
        activeUsers.push({name: name});
        res.send({redirect: '/messages'});
    } else {
        res.send({errorMsg: "Användarnamnet är upptaget. \nVänligen välj ett annat användarnamn."});
    }

    console.log('test: ' + activeUsers);

});

// ------------
var http = require('http').Server(app);
var io = require('socket.io')(http);

io.on('connection', function(socket){
  //message
  socket.on('broadcast message', function(message){
    io.emit('broadcast message', message);
  });
   socket.on('private message', function(message){
    io.emit('private message', message);
  });
});

http.listen(port, function(){
  console.log('Listening on: ' + port);
});
