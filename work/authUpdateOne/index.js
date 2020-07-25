const request = require('request');
//获取相关的第三方平台信息
const { component_appid } = require('../key.json');
const db = require('../database/lowdb');

//封装的http请求函数
function CallWeb(token,code) {
    return new Promise((resolve, reject) => {
        request({
            //获取授权信息的API
            url: 'https://api.weixin.qq.com/cgi-bin/component/api_query_auth?component_access_token=' + token,
            body: JSON.stringify({
                component_appid,
                authorization_code:code
            }),
            method: 'POST'
        }, (error, response, body) => {
            if (error) {
                reject(error);
            }
            resolve(response.body);
        });
    });
}

async function main(event){
    if(event.code==null||event.id==null) return null;
    try {
        //通过调用getComToken云函数获取第三方令牌
        let access_token = await require('../getComToken/index')();

        if (access_token != null) {
             //将令牌信息和授权码传入http请求函数，等待请求结果
            let result = await CallWeb(access_token,event.code);

            console.log(result);

            //结果是一个json字符串，验证是否有authorization_info字样，如果有则没有报错
            if (result.indexOf('authorization_info') != -1) {
                //解析字符串为json
                let { authorization_info } = JSON.parse(result);

                //取出字段
                let { authorizer_access_token,authorizer_appid,authorizer_refresh_token,expires_in,func_info} = authorization_info;

                //存储到mini中相应的文档里，并置状态为1
                return db.update_mini(event.id,{
                    status:1,
                    time:new Date(),
                    func_info,
                    access_token:authorizer_access_token,
                    access_time:new Date(new Date().getTime() + 1000 * expires_in),
                    appid:authorizer_appid,
                    refresh_token:authorizer_refresh_token
                });
            }
            else {
                console.log('wxcall failed！', result);
                return result;
            }
        }
        else {
            console.log('token get failed');
            return null;
        }
    }
    catch (e) {
        console.log('get failed!', e);
        return null;
    }
}

module.exports = main;