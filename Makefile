.PHONY: push-patch push-minor push-major

push-patch:
	npm version patch
	git push && git push origin --tags

push-minor:
	npm version minor
	git push && git push origin --tags

push-major:
	npm version major
	git push && git push origin --tags
