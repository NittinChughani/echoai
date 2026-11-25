/* ECHO AI provider configuration.
   Keep OVHcloud active until the Cloudflare Worker has been deployed and tested.
   Switch PROVIDER to 'cloudflare' and set API_BASE to the actual HTTPS Worker URL.
   Only the public Worker URL belongs here. Never add API tokens or other secrets. */
window.ECHO_CONFIG = Object.freeze({
  PROVIDER: 'ovh',
  API_BASE: ''
});
