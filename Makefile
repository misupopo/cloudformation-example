# .envファイルを読み込み
# bucketNameなどの引数を入力するのが毎回面倒なので.envから参照する
include .env
environmentVariables:=$(shell sed -ne 's/ *\#.*$$//; /./ s/=.*$$// p' .env )

# プロジェクト名
projectName := $(shell jq -r .ProjectName parameters/$(Environment)/common.json)
stackName ?= $(projectName)

ifeq ($(target), )
	@echo "you must add argument target"
	@exit 1
endif

# check arguments correctly
# make test target="test"
test:
	echo "target is $(target)"
	echo "projectName is $(projectName)"
	echo "environmentVariables is $(environmentVariables)"
	echo "Environment is $(Environment)"

####### deploy #######

# projectNameの引数はMakefile内に定義してあるので不要
# Environmentは与えければdevがdefault
deploy:
	cd scripts/cloudformation && npx ts-node deploy.ts -t $(target) -e $(Environment) -s $(stackName)

# parameter-overridesが存在する場合はdeploy-with-paramsを実行
deploy-with-params:
	aws cloudformation deploy \
		--stack-name $(stackName)-$(target) \
		--template-file $(target).yaml \
		--parameter-overrides \
		 $(params) \
		--capabilities CAPABILITY_NAMED_IAM

# parameterが存在しない場合はparameter-overridesのオプションを入れることができない
# parameter-overridesのオプションは空白も許容されない
deploy-without-params:
	aws cloudformation deploy \
		--stack-name $(stackName)-$(target) \
		--template-file $(target).yaml \
		--capabilities CAPABILITY_NAMED_IAM

####### update #######
# すでにスタックがあってバージョン情報などを更新する時

# バージョン情報や環境変数などの要素を更新したいときに実行する
# change-set-nameはversion1.0.1などの小数点は入力できない
update-package:
	aws cloudformation create-change-set \
		--stack-name $(projectName)-$(target) \
		--template-body file://$(target).yaml \
		--change-set-name $(changeSetName) \
		--capabilities CAPABILITY_IAM

# スタックを更新するための実行コマンド
# 事前に同じchangeSetNameをupdate-packageで行なってからexecute-update-packageを実行することができる
execute-update-package:
	aws cloudformation execute-change-set \
		--stack-name $(projectName)-$(target) \
		--change-set-name $(changeSetName)

# 途中まで入力したchange-setを出力する
list-change-set:
	aws cloudformation list-change-sets \
		--stack-name $(projectName)-$(target)

####### validate #######

validate:
	aws cloudformation validate-template \
		--template-body file://$(target).yaml
