<template>
  <div>
    <router-view
      :logs='logs'
      :areas='areas'
      :assets='assets'
      :units='units'
      :categories='categories'
      :equipment='equipment'
   />
    <div class="container-fluid">
      <br>
      <div class="card" v-if="isNative">
        <div class="card-header">NFC Tools</div>
        <div class="card-body">
          <p>NFC Disabled: {{ nfc_disabled }}</p>

          <select v-model="selectedAsset">
            <option
              v-for="(asset, i) in assets"
              v-bind:value="asset.id"
            >
              {{ asset.name }} - {{ asset.type }}
            </option>
          </select>


          <input v-model="selectedAsset" placeholder="Asset ID">

          <button @click="startWriteTag" v-bind:disabled="!selectedAsset || nfcWriteStarted">Write data to tag</button>
          <input v-model="nfcWriteStatus" v-if="nfcWriteStarted">

        </div>
      </div>
      <div class="card" v-else>
        <div class="card-header"></div>
        <div class="card-body">
          <h1>In da browser. </h1>
        </div>
      </div>
      <button @click="showSettings" v-if="nfc_disabled">Show Settings</button>
      <br>

    </div>
  </div>
</template>

<script>
// https://github.com/c4software/vuejs-cordova-sample/blob/master/src/views/Nfc.vue

export default {
  name: 'nfc',
  data: () => ({
    selectedAsset: null,
    nfcWriteStatus: 'Not started',
    nfcWriteStarted: null,
    compatible: true,
    nfc_disabled: true,
  }),
  props: ['logs', 'areas', 'assets', 'units', 'categories', 'equipment', 'systemOfMeasurement'],
  created() {
    this.$store.dispatch('updateUnits');
    this.$store.dispatch('updateCategories');
  },
  computed: {
    unitName() { return this.systemOfMeasurement === 'us' ? 'inches' : 'centimeters'; },
    unitAbbr() { return this.systemOfMeasurement === 'us' ? 'in' : 'cm'; },
    unitTid() { return this.units.find(u => u.name === this.unitName).tid; },
    isNative() {
      if (process.env.PLATFORM === 'native' || process.env.PLATFORM === 'dev') {
        return true;
      }
      return false;
    },
  },
  mounted() {
    // Register NFC Event Listeners
    this.registerTagEvent();
    this.mounted = true;
    this.syncAll();
  },
  beforeDestroy() {
    this.unregisterTagEvent();
  },
  methods: {
    /**
     * SYNCING
     */
    syncAll() {
      this.$store.dispatch('getServerLogs');
      this.$store.dispatch('updateAssets');
      this.$store.dispatch('updateAreas');
      this.$store.dispatch('updateUnits');
      this.$store.dispatch('updateCategories');
      this.$store.dispatch('updateEquipment');
    },

    registerTagEvent() {
      // Unregister previously « resume » event listener.
      document.removeEventListener('resume', this.registerTagEvent, false);
      if (typeof(nfc) !== 'undefined'){
        // Nfc is available, waiting for scan
        // MimeType listener has precedence over NdefListener
        nfc.addMimeTypeListener('application/farmos', this.onMime, this.success, this.error);
        // NdefListener to catch all Ndef events
        nfc.addNdefListener(this.onNdef, this.success, this.error);
      } else {
        // Plugin not present or failed to initialized.
        this.error();
      }
    },
    unregisterTagEvent() {
      // Test if the plugin is defined
      if (typeof (nfc) !== 'undefined') {
        // Remove listeners
        nfc.removeNdefListener(this.onNdef);
        nfc.removeMimeTypeListener('application/farmos', this.onMime);
      }
    },
    startWriteTag() {
      // Update variables for UI
      this.nfcWriteStarted = true;
      this.nfcWriteStatus = 'Waiting for tag..';
    },
    endWriteTag() {
      // Update variables for UI
      this.nfcWriteStarted = false;
      this.nfcWriteStatus = 'Not started';
    },
    writeTag(nfcEvent) {
      const { tag } = nfcEvent;
      const { techTypes } = tag;

      // MifareClassic cards are generally not supported.
      if (techTypes.includes('android.nfc.tech.MifareClassic')) {
        alert('MifareClassic card not supported.');
        // return;
      }

      // Update status for UI
      this.nfcWriteStatus = 'Writing...';

      // Build the message
      const mimeType = 'application/farmos';
      const recordData = {
        asset: {
          id: this.selectedAsset,
        },
      };
      const payload = JSON.stringify(recordData);
      const message = [
        ndef.mimeMediaRecord(mimeType, nfc.stringToBytes(payload)),
      ];

      // Write the message.
      nfc.write(
        message,
        () => alert('Write successful: '.concat(payload)),
        () => alert('Write unsuccessful: '.concat(payload)),
      );
    },
    onMime(nfcEvent) {
      // Handle an NFC Mime `application/farmos` event.
      const { tag } = nfcEvent;
      const { ndefMessage } = nfcEvent.tag;

      // Check if writing to a card.
      if (this.nfcWriteStarted) {
        this.writeTag(nfcEvent);
        this.endWriteTag();
        return;
      }

      // Display message
      let msg = 'Got a farmOS mime type: \n';
      const tagID = nfc.bytesToHexString(tag.id);
      ndefMessage.forEach((record) => {
        const type =  nfc.bytesToString(record.type);
        const payload = nfc.bytesToString(record.payload);
        const payloadObj = JSON.parse(payload);
        if (type === 'application/farmos') {
          if ('asset' in payloadObj && 'id' in payloadObj.asset) {
            const asset = this.assets.find(a => parseInt(a.id, 10) === parseInt(payloadObj.asset.id, 10));
            msg = 'This tag belongs to farm asset '.concat(payloadObj.asset.id, '\n');
            msg = msg.concat('Tag ID: ', tagID, '\n');
            msg = msg.concat('Name: ', asset.name, '\n');
            msg = msg.concat('Type: ', asset.type, '\n');
            alert(msg);
          }
        } else {
          msg = msg.concat('Tag: ', tagID, '\n');
          msg = msg.concat('Type: ', type, '\n');
          msg = msg.concat('Paylaod: ', payload, '\n');
          alert(msg);
        }
      });
    },
    onNdef(nfcEvent) {
      // Handle all Ndef events without MimeType of `application/farmos`
      const { tag } = nfcEvent;
      const { ndefMessage } = nfcEvent.tag;

      // Check if we are writing to a card.
      if (this.nfcWriteStarted) {
        this.writeTag(nfcEvent);
        this.endWriteTag();
        return;
      }

      // Display message
      let msg = 'Got an NDEF event. \n';
      msg = msg.concat('Tag ID: ', nfc.bytesToHexString(tag.id), '\n');
      ndefMessage.forEach((record) => {
        msg = msg.concat('type: ', nfc.bytesToString(record.type), '\n');
        msg = msg.concat('payload: ', nfc.bytesToString(record.payload), '\n');
      });
      alert(msg);
    },
    error(e) {
      // Manage the state
      if (e === 'NFC_DISABLED') {
        this.compatible = false;
        this.nfc_disabled = true;
      } else {
        this.nfc_disabled = false;
        this.compatible = false;
      }
    },
    success() {
      this.compatible = true;
      this.nfc_disabled = false;
    },
    showSettings() {
      // Trigger the phone settings to enable the Nfc settings
      // eslint-disable-next-line
      nfc.showSettings();
      // To refresh the state of the nfc, we add a listener to the « resume » event.
      // The resume event is triggered by cordova when the app is « Resumed ».
      document.addEventListener('resume', this.registerTagEvent, false);
    },
    unixToDateString(unixTimestamp) {
      const date = new Date(unixTimestamp * 1000);
      const dateFix = d => ((d < 10) ? `0${d}` : d);
      const mm = dateFix(date.getMonth() + 1);
      const dd = dateFix(date.getDate());
      return `${date.getFullYear()}-${mm}-${dd}`;
    },
    dateStringToUnix(nonUnixTimestamp) {
      const year = +nonUnixTimestamp.split('-')[0];
      const monthIndex = +nonUnixTimestamp.split('-')[1] - 1;
      const date = +nonUnixTimestamp.split('-')[2];
      return Math.floor(new Date(year, monthIndex, date).getTime() / 1000).toString();
    },
  },
};
</script>

<style>
  table svg {
    height: 1.25rem;
  }

  .add-wrapper {
    display: inline-block;
    vertical-align: bottom;
  }

  .add-wrapper svg {
    display: block;
  }

  #date-form {
    flex: 1 1 30%;
  }

  #hour-form, #minute-form, #am-pm-form {
    flex: 1 1 3rem;
  }

</style>
