#!/usr/bin/env bash
# 출동! 태겸 대원의 미션 대작전 → GitHub Pages 배포
#
# 사용법:
#   bash deploy.sh                       # saebyuk0124/taegyeomstudy 로 배포
#   bash deploy.sh owner/repo            # 다른 이름으로 배포
#
# 준비: 공개 저장소가 미리 있어야 합니다(저장소 "생성"은 GitHub 앱 권한 밖).
#       저장소가 있으면 이 스크립트가 코드 푸시 + Pages 자동 활성화(워크플로)까지 합니다.
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
else
  echo "▶ 커밋할 변경 없음"
fi
git branch -M main

git remote remove origin >/dev/null 2>&1 || true
git remote add origin "https://github.com/${REPO_SLUG}.git"

# 새 저장소에 README 커밋이 있어도 합쳐서 올립니다.
if git ls-remote --exit-code --heads origin main >/dev/null 2>&1; then
  git fetch -q origin main
  if ! git merge --allow-unrelated-histories -X ours --no-edit FETCH_HEAD >/dev/null 2>&1; then
    git merge --abort >/dev/null 2>&1 || true
    echo "! 기존 main 과 합치지 못했습니다. 이 저장소는 비어 있는 새 저장소여야 해요."
    exit 3
  fi
fi

echo "▶ 푸시…"
git push -u origin main

echo "▶ Pages 활성화 시도(권한이 있으면 즉시, 없으면 워크플로가 처리)…"
gh api -X POST "repos/${REPO_SLUG}/pages" -f "source[branch]=main" -f "source[path]=/" >/dev/null 2>&1 || true

URL="https://${OWNER}.github.io/${NAME}/"
[ "$NAME" = "${OWNER}.github.io" ] && URL="https://${OWNER}.github.io/"
echo "▶ 배포 주소: $URL"

for i in $(seq 1 24); do
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$URL" || true)"
  if [ "$code" = "200" ]; then
    echo "✔ 배포 완료: $URL"
    exit 0
  fi
  sleep 15
done

echo "… 아직 200 이 아닙니다. GitHub 저장소 → Actions 탭의 'Deploy to GitHub Pages' 실행 상태를 확인하세요."
echo "   저장소 → Settings → Pages 에서 Source 가 'GitHub Actions' 인지도 확인하면 됩니다."
echo "   주소: $URL"
