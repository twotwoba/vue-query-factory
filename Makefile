.PHONY: install build build-all clean lint fmt typecheck release

install:
	pnpm install

build:
	pnpm run build

build-all:
	pnpm run build && pnpm run build:types

clean:
	rm -rf dist

lint:
	pnpm run lint

lint:fix:
	pnpm run lint:fix

fmt:
	pnpm run fmt:write

fmt:check:
	pnpm run fmt:check

typecheck:
	pnpm run typecheck

# 发布流程
# 1. make version-patch  (或 version-minor / version-major)
# 2. git push --follow-tags
# 3. GitHub Actions 自动发布

version-patch:
	npm version patch -m "chore: release v%s"

version-minor:
	npm version minor -m "chore: release v%s"

version-major:
	npm version major -m "chore: release v%s"

# 本地 dry-run 发布（不实际发布）
publish-dry:
	pnpm publish --dry-run --access public
