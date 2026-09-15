#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$PROJECT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js가 필요합니다. Node 22를 활성화한 뒤 다시 실행해 주세요." >&2
  exit 1
fi

# CocoaPods' React Native prebuilt file URLs require a physical ASCII path.
if ! node -e 'process.exit(/^[\x20-\x7e]+$/.test(process.argv[1]) ? 0 : 1)' "$PROJECT_DIR"; then
  if [ "${1:-}" = "--prepare-only" ]; then
    exec node scripts/prepare-ios.mjs --prepare-only
  fi
  IOS_BUILD_DIR="$(node scripts/prepare-ios.mjs)"
  cd "$IOS_BUILD_DIR"
  exec bash scripts/ios.sh "$@"
fi
if [ "${1:-}" = "--prepare-only" ]; then
  echo "$PROJECT_DIR"
  exit 0
fi

ruby_supported() {
  ruby -e 'v = Gem::Version.new(RUBY_VERSION); exit(v >= Gem::Version.new("3.3") && v < Gem::Version.new("4.0") ? 0 : 1)' 2>/dev/null
}

if ! ruby_supported; then
  for ruby_bin in /opt/homebrew/opt/ruby@3.3/bin /usr/local/opt/ruby@3.3/bin; do
    if [ -x "$ruby_bin/ruby" ]; then
      export PATH="$ruby_bin:$PATH"
      break
    fi
  done
fi
if ! ruby_supported; then
  echo "Ruby 3.3 이상, 4.0 미만이 필요합니다. Homebrew 사용 시 brew install ruby@3.3 후 다시 실행해 주세요." >&2
  exit 1
fi

if [ ! -d node_modules/expo ]; then
  echo "먼저 프로젝트에서 npm install을 실행해 주세요." >&2
  exit 1
fi

RUBY_SERIES="$(ruby -e 'print RUBY_VERSION.split(".").first(2).join')"
export GEM_HOME="$PROJECT_DIR/.build/gems$RUBY_SERIES"
export GEM_PATH="$GEM_HOME"
export GEM_SPEC_CACHE="$GEM_HOME/spec-cache"
export BUNDLE_USER_HOME="$PROJECT_DIR/.build/bundle"
export BUNDLE_GEMFILE="$PROJECT_DIR/Gemfile"
export CP_HOME_DIR="$PROJECT_DIR/.build/cocoapods"
export CP_CACHE_DIR="$CP_HOME_DIR/cache"
export PATH="$GEM_HOME/bin:$PATH"
export RCT_NEW_ARCH_ENABLED=1
export NODE_BINARY="$(command -v node)"
mkdir -p .build

bundle check >/dev/null 2>&1 || bundle install
npx expo prebuild --no-install --platform ios
bundle exec pod install --project-directory=ios

if [ "${1:-}" = "--check" ]; then
  export RCT_NO_LAUNCH_PACKAGER=1
  export SKIP_BUNDLING=1
  echo "서명 없이 iPhone용 네이티브 코드를 컴파일합니다. 로그: .build/ios-check.log"
  if xcodebuild -workspace ios/app.xcworkspace -scheme app -configuration Debug \
    -sdk iphoneos -destination 'generic/platform=iOS' -derivedDataPath .build/ios \
    CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO build > .build/ios-check.log 2>&1; then
    echo "iPhone용 네이티브 컴파일 성공. 기기에 설치하거나 AR을 실행한 결과는 아닙니다."
  else
    tail -60 .build/ios-check.log
    exit 1
  fi
else
  echo "원본 프로젝트에서 npm start를 실행해 주세요. 개발 앱은 8081 포트의 Metro를 사용합니다."
  bundle exec npx expo run:ios --device --no-bundler "$@"
fi
