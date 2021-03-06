var mongoose = require( 'mongoose' );

mongoose.connect( 'mongodb://localhost/REpoUM' );

var Log = mongoose.model( 'Log', new mongoose.Schema( {
    action: {
        type: String
    },
    date: {
        type: Date,
        default: () => Date.now()
    },
    user: {
        _id: mongoose.Schema.Types.ObjectId,
        username: String
    }
} ) );

const User = mongoose.model( 'User', new mongoose.Schema( {
    username: String,
  	email: String,
    password: String,
    salt: String,
    group: String,
  	approved: Boolean,
    deleted: {type:Boolean,default:()=> false}
} ) );

const Package = mongoose.model( 'Package', new mongoose.Schema( {
    meta: new mongoose.Schema( {
        title: String,
        publishedDate: Date,
        type: String,
        access: String,
        context: String
    } ),
    authors: [ {
        name: String,
        email: String,
        course: String,
        id: String
    } ],
    supervisors: [ {
        name: String,
        email: String
    } ],
    keywords: [ String ],
    abstract: mongoose.Schema.Types.Mixed,
    files: [ {
        description: String,
        path: String
    } ],
    folder: String,
    state: { type: String, enum: [ 'public', 'private', 'deleted' ], default: 'public' },
    approved: { type: Boolean, default: () => false },
    approvedAt: Date,
    approvedBy: mongoose.Schema.Types.ObjectId,
    createdBy: mongoose.Schema.Types.ObjectId,
    createdAt: { type: Date, default: Date.now },
    downloadsCount:{type:Number,default:0},
    visitsCount:{type:Number,default:0},
    index:{type:Number}
} ).index( { name: 'text', 'meta.title': 'text' } ) );

const Settings = mongoose.model( 'Settings', new mongoose.Schema( {
	key: String,
  	value: mongoose.Schema.Types.Mixed
} ) );

module.exports = {
    Log, User, Package, Settings
};
