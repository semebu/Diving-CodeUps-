import gulp from "gulp";
import dartSass from "sass";
import gulpSass from "gulp-sass";
import plumber from "gulp-plumber";
import notify from "gulp-notify";
import sassGlob from "gulp-sass-glob-use-forward";
import mmq from "gulp-merge-media-queries";
import postcss from "gulp-postcss";
import autoprefixer from "autoprefixer";
import cssdeclsort from "css-declaration-sorter";
import postcssPresetEnv from "postcss-preset-env";
import sourcemaps from "gulp-sourcemaps";
import babel from "gulp-babel";
import imagemin from "gulp-imagemin";
import imageminMozjpeg from "imagemin-mozjpeg";
import imageminPngquant from "imagemin-pngquant";
import changed from "gulp-changed";
import del from "del";
import webp from "gulp-webp";
import rename from "gulp-rename";
import browserSyncLib from "browser-sync";

const { src, dest, watch, series, parallel } = gulp;
const sass = gulpSass(dartSass);
const browserSync = browserSyncLib.create();

// imagemin-svgo は ESモジュールなので dynamic import を使う
let imageminSvgo;
const loadImageminSvgo = async () => {
  if (!imageminSvgo) {
    const mod = await import("imagemin-svgo");
    imageminSvgo = mod.default;
  }
};

// パス設定
const srcPath = {
  css: "../src/sass/**/*.scss",
  js: "../src/js/**/*",
  img: "../src/images/**/*",
  html: ["../src/**/*.html", "!./node_modules/**"],
};

const destPath = {
  all: "../dist/**/*",
  css: "../dist/assets/css/",
  js: "../dist/assets/js/",
  img: "../dist/assets/images/",
  html: "../dist/",
};

const browsers = ["last 2 versions", "> 5%", "ie = 11", "not ie <= 10", "ios >= 8", "and_chr >= 5", "Android >= 5"];

// HTML コピー
const htmlCopy = () => src(srcPath.html).pipe(dest(destPath.html));

// SCSS → CSS
const cssSass = () => {
  return src(srcPath.css)
    .pipe(sourcemaps.init())
    .pipe(plumber({ errorHandler: notify.onError("Error:<%= error.message %>") }))
    .pipe(sassGlob())
    .pipe(
      sass.sync({
        includePaths: ["src/sass"],
        outputStyle: "expanded",
      })
    )
    .pipe(
      postcss([
        postcssPresetEnv(),
        autoprefixer({ grid: true }),
        cssdeclsort({ order: "alphabetical" }),
      ])
    )
    .pipe(mmq())
    .pipe(sourcemaps.write("./"))
    .pipe(dest(destPath.css))
    .pipe(notify({ message: "Sassをコンパイルしました！", onLast: true }));
};

// 画像圧縮
const imgImagemin = async () => {
  await loadImageminSvgo();

  return src(srcPath.img)
    .pipe(changed(destPath.img))
    .pipe(
      imagemin(
        [
          imageminMozjpeg({ quality: 80 }),
          imageminPngquant(),
          imageminSvgo({ plugins: [{ removeViewbox: false }] }),
        ],
        { verbose: true }
      )
    )
    .pipe(dest(destPath.img))
    .pipe(webp())
    .pipe(dest(destPath.img));
};

// JS Babel変換
const jsBabel = () => {
  return src(srcPath.js)
    .pipe(plumber({ errorHandler: notify.onError("Error: <%= error.message %>") }))
    .pipe(
      babel({
        presets: ["@babel/preset-env"],
      })
    )
    .pipe(dest(destPath.js));
};

// BrowserSync設定
const browserSyncOption = {
  notify: false,
  server: "../dist/",
};

const browserSyncFunc = () => {
  browserSync.init(browserSyncOption);
};

const browserSyncReload = (done) => {
  browserSync.reload();
  done();
};

// dist削除
const clean = () => del(destPath.all, { force: true });

// ファイル監視
const watchFiles = () => {
  watch(srcPath.css, series(cssSass, browserSyncReload));
  watch(srcPath.js, series(jsBabel, browserSyncReload));
  watch(srcPath.img, series(imgImagemin, browserSyncReload));
  watch(srcPath.html, series(htmlCopy, browserSyncReload));
};

// 開発用タスク
export default series(
  series(cssSass, jsBabel, imgImagemin, htmlCopy),
  parallel(watchFiles, browserSyncFunc)
);

// 本番用ビルドタスク
export const build = series(clean, cssSass, jsBabel, imgImagemin, htmlCopy);
