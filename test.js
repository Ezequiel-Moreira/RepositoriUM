
var { User, Package, Settings } = require( './services/database.js' );
var uid = require( 'uid-safe' );
var sha = require( 'sha.js' );


Package.find().then( async packages => {
    for ( let [index, pkg] of packages.entries() ) {
        pkg.index = index;

        await pkg.save();
    }

    let setting = await Settings.findOne( { key: 'packagesIndex' } ).exec();

    if ( !setting ) {
        setting = new Settings( { key: 'packagesIndex', value: 0 } );
    }

    setting.value = packages.length;
    console.log( setting.value );

    await setting.save();
} );
