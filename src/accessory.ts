import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  HAP,
  Logging,
  Service
} from "homebridge";

import http = require('http');

/*
 * IMPORTANT NOTICE
 *
 * One thing you need to take care of is, that you never ever ever import anything directly from the "homebridge" module (or the "hap-nodejs" module).
 * The above import block may seem like, that we do exactly that, but actually those imports are only used for types and interfaces
 * and will disappear once the code is compiled to Javascript.
 * In fact you can check that by running `npm run build` and opening the compiled Javascript file in the `dist` folder.
 * You will notice that the file does not contain a `... = require("homebridge");` statement anywhere in the code.
 *
 * The contents of the above import statement MUST ONLY be used for type annotation or accessing things like CONST ENUMS,
 * which is a special case as they get replaced by the actual value and do not remain as a reference in the compiled code.
 * Meaning normal enums are bad, const enums can be used.
 *
 * You MUST NOT import anything else which remains as a reference in the code, as this will result in
 * a `... = require("homebridge");` to be compiled into the final Javascript code.
 * This typically leads to unexpected behavior at runtime, as in many cases it won't be able to find the module
 * or will import another instance of homebridge causing collisions.
 *
 * To mitigate this the {@link API | Homebridge API} exposes the whole suite of HAP-NodeJS inside the `hap` property
 * of the api object, which can be acquired for example in the initializer function. This reference can be stored
 * like this for example and used to access all exported variables and classes from HAP-NodeJS.
 */
let hap: HAP;

/*
 * Initializer function called when the plugin is loaded.
 */
export = (api: API) => {
  hap = api.hap;
  api.registerAccessory("RGBLightStrip", RGBLightStrip);
};

interface ServerResponse {
  data: ServerData
}

interface ServerData {
  foo: string
  bar: number
}

class RGBLightStrip implements AccessoryPlugin {

  private readonly log: Logging;
  private readonly name: string;
  private readonly ip: string;
  private readonly port: string;
  private switchOn: boolean;
  private brightness: number;
  private colorTemp: number;
  private readonly stripeService: Service;
  private readonly informationService: Service;

  postHttp(type: string) {
    this.log.info("postHttp to ESP8266");
    this.log.info(type);

    // Build the post string from an object
    var post_data = '';

    // An object of options to indicate where to post to
    var post_options = {
        host: this.ip, //'192.168.178.88',
        port: this.port, //'80',
        path: type, //'/power?value=1',
        method: 'POST',
        timeout: 300,
    };

    // Set up the request
    var post_req = http.request(post_options, function(res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            console.log('Response: ' + chunk);
        });
    });

    // post the data
    post_req.write(post_data);
    post_req.end();
  }

  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.ip = config.ip;
    this.port = config.port;
    this.name = config.name;
    this.switchOn = false;
    this.brightness = 0;
    this.colorTemp = 8;

    this.log.info("RGBLightStrip: constructor");
    this.log.info("IP: ", this.ip);
    this.log.info("Port: ", this.port);
    try {
      this.log.info('HTTP request for Power state');
      http.request(
        {
          host: this.ip, //'192.168.178.88',
          port: this.port, //'80',
          path: '/fieldValue?name=power',
          method: 'GET',
          timeout: 300,
        },
        (r: http.IncomingMessage): void => {
          let data = '';
          r.on('data', (chunk: string): void => {
              this.log.info('Got chunk: ' + chunk);
              data += chunk;
          });
          r.on('end', (): void =>{
              this.log.info('Response has ended');
              this.log.info(data.toString());
              this.switchOn = (data.toString() == '0' ? false : true);
              this.log.info("Initial state of the switch was returned: " + (this.switchOn? "ON": "OFF"));
          });
          r.on('error', (err): void => {
              this.log.error('Following error occured during initial request:\n');
              this.log.error(err.toString());
          })
        }).end();
    } catch {
      this.log.error("exception during initial switch http get");
    }  

    try {
      this.log.info('HTTP request for Brightness state');
      http.request(
        {
          host: this.ip, //'192.168.178.88',
          port: this.port, //'80',
          path: '/fieldValue?name=brightness',
          method: 'GET',
          timeout: 300,
        },
        (r: http.IncomingMessage): void => {
          let data = '';
          r.on('data', (chunk: string): void => {
              this.log.info('Got chunk: ' + chunk);
              data += chunk;
          });
          r.on('end', (): void =>{
              this.log.info('Response has ended');
              this.log.info(data.toString());
              this.brightness = Number(data.toString());
              this.log.info("Initial brightness was returned: " + this.brightness);
          });
          r.on('error', (err): void => {
              this.log.error('Following error occured during initial request:\n');
              this.log.error(err.toString());
          })
        }).end();
    } catch {
      this.log.error("exception during initial brightness http get");
    }

    this.stripeService = new hap.Service.Lightbulb(this.name);
    this.stripeService.getCharacteristic(hap.Characteristic.On)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        try {
          this.log.info('HTTP request for getCharacteristics(hap.Characteristic.On)');
          http.request(
            {
              host: this.ip, //'192.168.178.88',
              port: this.port, //'80',
              path: '/fieldValue?name=power',
              method: 'GET',
              timeout: 300,
            },
            (r: http.IncomingMessage): void => {
              let data = '';
              r.on('data', (chunk: string): void => {
                  this.log.info('Got chunk: ' + chunk);
                  data += chunk;
              });
              r.on('end', (): void =>{
                  this.log.info('Response has ended');
                  this.log.info(data.toString());
                  this.switchOn = (data.toString() == '0' ? false : true);
                  this.log.info("Current state of the switch was returned: " + (this.switchOn? "ON": "OFF"));
                  callback(undefined, this.switchOn);
              });
              r.on('error', (err): void => {
                  this.log.error('Following error occured during request:\n');
                  this.log.error(err.toString());
                  callback();
              })
            }).end();
        } catch {
          this.log.error("exception during switch http get")
          callback();
        }
      })
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        this.log.info('HTTP request for setCHaracteristics(hap.CHaracteristic.On)');
        this.switchOn = value as boolean;
        this.postHttp( (value ? "/power?value=1" : "/power?value=0"));
        this.log.info("Switch state was set to: " + (this.switchOn? "ON": "OFF"));
        callback();
      });

    this.stripeService.getCharacteristic(hap.Characteristic.Brightness)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        try { 
          this.log.info('HTTP request for getCHaracteristics(hap.CHaracteristic.Brightness)');
          http.request(
            {
              host: this.ip, //'192.168.178.88',
              port: this.port, //'80',
              path: '/fieldValue?name=brightness',
              method: 'GET',
              timeout: 300,
            },
            (r: http.IncomingMessage): void => {
              let data = '';
              r.on('data', (chunk: string): void => {
                  this.log.info('Got chunk: ' + chunk);
                  data += chunk;
              });
              r.on('end', (): void =>{
                  this.log.info('Response has ended');
                  this.log.info(data.toString());
                  this.brightness = Number(data.toString());
                  this.log.info("Current brightness was returned: " + this.brightness);
                  callback(undefined, this.brightness);
              });
              r.on('error', (err): void => {
                  this.log.error('Following error occured during request:\n');
                  this.log.error(err.toString());
                  callback();
              })
            }).end();
        } catch {
          this.log.error("exception during brightness http get");
          callback();
        }
      })
      .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
        this.log.info('HTTP request for setCHaracteristics(hap.CHaracteristic.Brightness)');
        this.brightness = value as number;
        this.postHttp( "/brightness?value=" + this.brightness );
        this.log.info("Brightness was set to: " + this.brightness);
        callback();
      });

    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, "Michael Leopoldseder")
      .setCharacteristic(hap.Characteristic.Model, "V1.0")
      .setCharacteristic(hap.Characteristic.SerialNumber, "xxxxxx1");

    this.log.info("RGBLightStip finished initializing!");
  }

  /*
   * This method is optional to implement. It is called when HomeKit ask to identify the accessory.
   * Typical this only ever happens at the pairing process.
   */
  identify(): void {
    this.log.info("RGBLightStrip Identify!");
  }

  /*
   * This method is called directly after creation of this instance.
   * It should return all services which should be added to the accessory.
   */
  getServices(): Service[] {
    this.log.info("RGBLightStip: getServices()");
    return [
      this.informationService,
      this.stripeService,
    ];
  }

}
