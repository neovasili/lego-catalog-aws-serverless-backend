const AWS = require('aws-sdk');
AWS.config.update( { region: 'eu-west-1' } );
const dynamo = new AWS.DynamoDB( { apiVersion: '2012-10-08' } );
const docClient = new AWS.DynamoDB.DocumentClient();

const tableName = process.env.TableName;


function createPostBody( item ) {
    
    let params = new Object();
    let paramsItem = new Object();
    
    for( var attribute in item ) {
        
        let itemValue = new Object();
        
        switch( typeof( item[ attribute ] ) ){
            case 'number': 
                itemValue[ 'N' ] = item[ attribute ].toString();
                break;
            case 'boolean':
                itemValue[ 'BOOL' ] = item[ attribute ];
                break;
            default:
                itemValue[ 'S' ] = item[ attribute ];
        }
        
        paramsItem[ attribute ] = itemValue;
    }
    
    params[ 'TableName' ] = tableName;
    params[ 'Item' ] = paramsItem;
    
    return params;
}

function createGetDeleteBody( setReference ) {
    
    let params = {
        TableName: process.env.TableName,
        Key: {
            'setReference': { S: setReference }
        }
    };
    
    return params;
}

function createGetMultipleItemsBody( userID ) {
    
    let params = {
        TableName: process.env.TableName,
        Key: {
            'userID': { S: userID }
        }
    };
    
    return params;
}

function extractItemValues( event ) {
    
    let itemModel = new Object();
    
    let queryStringParameters = null;
    let requestContent = null;
    
    if( event.body == null ) {
        queryStringParameters = event.queryStringParameters;
        
        if( queryStringParameters != null ) {
            requestContent = queryStringParameters;
        }
    } else {
        requestContent = JSON.parse( event.body );
    }
    
    if( requestContent != null ) {
        for( var attribute in requestContent ) {
            itemModel[ attribute ] = requestContent[ attribute ];
        }
    }
    
    return itemModel;
}

/**
 * Demonstrates a simple HTTP endpoint using API Gateway. You have full
 * access to the request and response payload, including headers and
 * status code.
 *
 * To scan a DynamoDB table, make a GET request with the TableName as a
 * query string parameter. To put, update, or delete an item, make a POST,
 * PUT, or DELETE request respectively, passing in the payload to the
 * DynamoDB API as a JSON body.
 */
exports.handler = ( event, context, callback ) => {
    
    //console.log( 'Received event:', JSON.stringify( event, null, 2 ) );
    
    const done = ( err, res ) => callback( null, {
        statusCode: err ? '400' : '200',
        body: err ? JSON.stringify( err.message ) : JSON.stringify( res ),
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
    });
    
    const item = extractItemValues( event );
    
    console.log( 'item: ', item );
    
    if( event.httpMethod == 'GET' ) {
        if( item.userID != null ) {
            docClient.scan( createGetMultipleItemsBody( item.userID ), done );
            // dynamo.getItem( createGetMultipleItemsBody( item.userID ), done );
        } else {
            dynamo.getItem( createGetDeleteBody( item.setReference ), done );
        }
    } else {
        if( item.setReference == null ) {
            done( new Error( "setReference is a mandatory parameter" ) );
            
        } else {
        
            console.log( 'setReference: ', item.setReference );
        
            switch ( event.httpMethod ) {
                case 'DELETE':
                    dynamo.deleteItem( createGetDeleteBody( item.setReference ), done );
                    break;
                case 'POST':
                    dynamo.getItem( createGetDeleteBody( item.setReference ), function( error, data ) {
                        
                        if( error ) {
                            done( new Error( error.message ) );
                        }
                        else {
                            if( data.Item == null ) {
                                dynamo.putItem( createPostBody( item ), done );
                            } else {
                                done( new Error( "Item already exists YEAH" ) );
                            }
                        }
                    } );
                    break;
                case 'PUT':
                    dynamo.putItem( createPostBody( item ), done );
                    break;
                default:
                    done( new Error( `Unsupported method "${ event.httpMethod }"` ) );
            }
        }
    }
};
