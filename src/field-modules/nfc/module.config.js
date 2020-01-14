import nfc from './components/NFC';
import NFCMenuBar from './components/NFCMenuBar';
import DrawerItems from './components/DrawerItems';

export default {
  name: 'nfc-test',
  drawer: DrawerItems,
  routes: [
    {
      name: 'nfc-test',
      path: '/nfc',
      components: {
        default: nfc,
        menubar: NFCMenuBar,
      },
    },
  ],
};
