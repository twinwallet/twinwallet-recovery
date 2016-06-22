var gulp = require('gulp');
var gutil = require('gulp-util');
var bower = require('bower');
var browserify = require('browserify');
var buffer = require('vinyl-buffer');
var concat = require('gulp-concat');
var sass = require('gulp-sass');
var minifyCss = require('gulp-minify-css');
var rename = require('gulp-rename');
var sh = require('shelljs');
var source = require('vinyl-source-stream');
var uglify = require('gulp-uglify');
var flatten = require('gulp-flatten')
var changed = require('gulp-changed')

var paths = {
  sass: ['./scss/**/*.scss'],
  cssLibs: [
    'bower_components/ionic/css/ionic.css',
    'bower_components/angular-tooltips/dist/angular-tooltips.min.css'
  ],
  libs: [
    './node_modules/angular-bitcore-wallet-client/index.js',
    './node_modules/angular-twinwallet-recovery/angular-twinwallet-recovery.js',
    './libs/cosignkey.js'
  ],
  angularLibs: [
    'bower_components/ionic/js/ionic.bundle.min.js',
    'bower_components/angular-messages/angular-messages.min.js',
    'bower_components/angular-tooltips/dist/angular-tooltips.min.js'
  ],
  fonts: 'bower_components/ionic/fonts/*'
};

gulp.task('default', ['copy-ionic-fonts', 'css-libs', 'libs', 'angular-libs']);

gulp.task('copy-ionic-fonts', function () {
  var DEST = 'www/fonts'
  gulp.src(paths.fonts)
    .pipe(flatten())
    .pipe(changed(DEST))
    .pipe(gulp.dest(DEST))
})

// gulp.task('sass', function(done) {
//   gulp.src('./scss/ionic.app.scss')
//     .pipe(sass())
//     .on('error', sass.logError)
//     .pipe(gulp.dest('./www/css/'))
//     .pipe(minifyCss({
//       keepSpecialComments: 0
//     }))
//     .pipe(rename({ extname: '.min.css' }))
//     .pipe(gulp.dest('./www/css/'))
//     .on('end', done);
// });

gulp.task('libs', function () {
  // set up the browserify instance on a task basis
  return browserify({
      entries: paths.libs,
      debug: true
    })
    .bundle()
    .pipe(source("libs.js"))
    .pipe(buffer())
    .pipe(gulp.dest('./www/lib/'))
    .pipe(uglify())
    .pipe(rename({ extname: '.min.js' }))
    .pipe(gulp.dest('./www/lib/'));
});

gulp.task('angular-libs', function () {
  gulp.src(paths.angularLibs)
    .pipe(concat('angular-libs.js'))
    .pipe(gulp.dest('www/lib/'))
});

gulp.task('css-libs', function () {
  gulp.src(paths.cssLibs)
    .pipe(concat('css-libs.css'))
    .pipe(gulp.dest('www/css/'))
});

// gulp.task('watch', function() {
//   gulp.watch(paths.sass, ['sass']);
// });
