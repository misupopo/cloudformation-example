import * as fs from 'fs/promises';
import { exec } from 'child_process';
import * as yargs from 'yargs';
import * as JSON5 from 'json5';

import type { CommonParams } from './paramsType';

const argv = yargs
  .option('target', {
    alias: 't',
    description: 'create zip directory',
    demandOption: true,
    type: 'string',
  })
  .option('environment', {
    alias: 'e',
    description: 'handling parameters with env',
    demandOption: true,
    type: 'string',
  })
  .option('stackName', {
    alias: 's',
    description: 'stack name',
    demandOption: true,
    type: 'string',
  })
  .help()
  .parseSync();

const parametersPath = `../../parameters/${!argv.environment ? 'dev' : argv.environment}`;

console.log(`Environment is ${!argv.environment ? 'dev' : argv.environment}`);

const execAsync = (command: string) => {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    exec(command, (err, stdout, stderr) => {
      if (err) {
        reject(err);
        return;
      }
      resolve({
        stdout,
        stderr,
      });
    });
  });
};

const deploy = async (params: CommonParams & unknown, target: string) => {
  const formatParams = Object.keys(params).reduce((collection, key) => {
    collection = `${collection === '' ? '' : `${collection} `}${key}=${params[key]}`;
    return collection;
  }, '');

  // const test = `aws cloudformation deploy --stack-name example-sqs --template-file sqs.yaml --parameter-overrides ParameterKey=test test2=2 --capabilities CAPABILITY_NAMED_IAM`;

  // const command =
  //   formatParams !== ''
  //     ? `aws cloudformation deploy \
  //       --stack-name example-${target} \
  //       --template-file ${target}.yaml \
  //       --parameter-overrides \
  //       ${formatParams} \
  //       --capabilities CAPABILITY_NAMED_IAM`
  //     : `make deploy-without-params target="${target}"`;

  // ダブルクォートでformatParamsは括らないと複数のパラメーターを認識できない
  const command =
    formatParams !== ''
      ? `make deploy-with-params params="${formatParams}" target="${target}" stackName="${argv.stackName}"`
      : `make deploy-without-params target="${target}" stackName="${argv.stackName}"`;

  // ルートで実行しないといけないので cd ../../ でルートに戻ってから実行
  await execAsync(`cd ../../ && ${command}`);
};

const readJsonFile = async (target: string, isJson5: boolean = true) => {
  const filePath = `${parametersPath}/${target}.json${isJson5 ? '5' : ''}`;

  // 対象のファイルが存在しない場合は空のオブジェクトを返す
  try {
    await fs.stat(filePath);
  } catch (e) {
    return {};
  }

  return JSON5.parse(await fs.readFile(filePath, 'utf8'));
};

(async () => {
  try {
    if (!argv.target) {
      throw new Error('it must be target argument');
    }

    // commonは共通のparameter
    const commonParams = (await readJsonFile('common', false)) as CommonParams;
    const targetParams = await readJsonFile(argv.target);

    // 共通で使うパラメーターと対象のパラメーターをマージする
    await deploy(
      Object.assign(commonParams, targetParams, { StackName: argv.stackName }),
      argv.target
    );
    console.log(`success deploy template ${parametersPath}/${argv.target}.yaml`);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
