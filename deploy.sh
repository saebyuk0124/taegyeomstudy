#!/usr/bin/env bash
# 출동! 태겸 대원의 미션 대작전 → GitHub Pages 배포
#
# 사용법:
#   bash deploy.sh                       # saebyuk0124/taegyeomstudy 로 배포
#   bash deploy.sh owner/repo            # 다른 이름으로 배포
#
# 하는 일:
#   1) main 브랜치에 커밋하고 푸시
#   2) 같은 내용을 gh-pages 브랜치로 올려 게시 (GitHub Pages 소스 = gh-pages)
#   3) 사이트가 200 을 돌려줄 때까지 확인
#
# 준비: 공개 저장소가 미리 있어야 합니다(저장소 "생성"은 GitHub 앱 권한 밖).
set -euo pipefail

REPO_SLUG="${1:-saebyuk0124/taegyeomstudy}"
OWNER="${REPO_SLUG%%/*}"
NAME="${REPO_SLUG##*/}"
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "▶ 대상 저장소: $REPO_SLUG"

if ! gh repo view "$REPO_SLUG" >/dev/null 2>&1; then
  echo "✖ 저장소가 없습니다. 이 GitHub 연결에는 저장소 생성 권한(administration)이 없어요."
  echo "  github.com 에서 공개 저장소 '$NAME' 을 만든 뒤 다시 실행해 주세요."
  echo "  (New repository → Repository name: $NAME → Public → Create repository)"
  exit 2
fi

LOGIN="$(gh api user --jq .login 2>/dev/null || echo "$OWNER")"
MAIL="$(gh api user --jq '(.email // "")' 2>/dev/null || true)"
[ -z "${MAIL}" ] && MAIL="${LOGIN}@users.noreply.github.com"

[ -d .git ] || git init -q
git add -A
if ! git diff --cached --quiet 2>/dev/null; then
  git -c user.name="$LOGIN" -c user.email="$MAIL" -c commit.gpgsign=false \
      commit -q -m "출동! 태겸 대원의 미션 대작전 🐾"
  echo "▶ 커밋 생성"
else
  echo "▶ 커밋할 변경 없음"
fi
git branch -M main

git remote remove origin >/dev/null 2>&1 || true
git remote add origin "https://github.com/${REPO_SLUG}.git"

# 새 저장소에 README 커밋이 있어도 합쳐서 올립니다(우리 파일 우선).
if git ls-remote --exit-code --heads origin main >/dev/null 2>&1; then
  git fetch -q origin main
  if ! git merge --allow-unrelated-histories -X ours --no-edit FETCH_HEAD >/dev/null 2>&1; then
    git merge --abort >/dev/null 2>&1 || true
    echo "! 기존 main 과 합치지 못했습니다. 저장소 상태를 확인해 주세요."
    exit 3
  fi
fi

echo "▶ main 푸시…"
git push -u origin main

echo "▶ gh-pages 게시…"
# GitHub App 에 workflows 권한이 없어 .github/ 는 올리지 않습니다.
git push -f origin main:gh-pages >/dev/null

URL="https://${OWNER}.github.io/${NAME}/"
[ "$NAME" = "${OWNER}.github.io" ] && URL="https://${OWNER}.github.io/"
echo "▶ 배포 주소: $URL"

for i in $(seq 1 24); do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$URL" || true)"
  if [ "$code" = "200" ]; then
    echo "✔ 배포 완료: $URL"
    exit 0
  fi
  sleep 10
done

echo "… 아직 200 이 아닙니다."
echo "   저장소 → Settings → Pages 에서 Source 가 'Deploy from a branch / gh-pages / (root)' 인지 확인하세요."
echo "   주소: $URL"
