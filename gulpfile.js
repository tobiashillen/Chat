/*-----------------------------------
Starta med 'gulp' i terminalen.
Varje gång en watchedFiles ändras körs JsHint, cuncat på filerna och startar om servern.
Lägg till filvägar i watchedFiles om du vill att fler filer kollas.
-----------------------------------*/

var gulp = require('gulp'),
    jshint = require('gulp-jshint'),
    gulpLiveServer = require('gulp-live-server'),
    concat = require('gulp-concat');

var watchedFiles = ['./public/scripts/script.js', 'public/lib/*.js', './public/controllers/index.js'];

gulp.task('jshint', function () {
    return gulp.src(watchedFiles)
        .pipe(jshint())
        .pipe(jshint.reporter('default'));
});

gulp.task('serve', function() {
    var server = gulpLiveServer.new('server.js');
    server.start();

    gulp.watch('server.js', function (file) {
        server.start.apply(server);
    });
});

gulp.task('scripts', function() {
  return gulp.src(watchedFiles)
    .pipe(concat('concat.js'))
    .pipe(gulp.dest('./public/dist/'));
});

gulp.task('listen', function() {
    gulp.watch(watchedFiles, ['jshint', 'scripts']);
});

gulp.task('default', ['scripts', 'listen', 'serve']);
