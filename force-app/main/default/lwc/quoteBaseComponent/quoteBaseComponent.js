import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import cloneRecord from '@salesforce/apex/QuoteController.cloneRecord';
import getInfo from '@salesforce/apex/QuoteController.getInformation';
import isAscendQuote from '@salesforce/apex/QuoteController.isAscendQuote';
import getExistCoveragesQuote from '@salesforce/apex/QuoteController.getExistCoveragesQuote';
import deleteQuote from '@salesforce/apex/QuoteController.deleteQuote';
import saveLimit from '@salesforce/apex/AcceptQuoteController.saveLimit';
import { NavigationMixin } from 'lightning/navigation';
import addToCurrentProposal from '@salesforce/apex/AddQuoteToCurrentProposal.addToCurrentProposal';
import getQuoteCoverageLinks from '@salesforce/apex/QuoteController.getQuoteCoverageLinks';
import getCoverageLinkFieldSetLightning from '@salesforce/apex/QuoteController.getCoverageLinkFieldSetLightning';
import getCoverages from '@salesforce/apex/QuoteController.getCoveragesQuote';

export default class QuoteBaseComponent extends NavigationMixin(LightningElement) {

    @track isView = true;
    @track isEdit = false;
    @track onsave = false;
    @track allMapValue = new Map();
    @track mapValueLim = new Map();
    @track isAddorRemoveCov = false;
    @track isAcceptQuote = false;
    @track isRejectQuote = false;
    @track isUpdateQuote = false;
    @track showCloneModal = false;
    @track loadSpinner = false;
    @track testlimitsave;
    @track isAcceptedButton = false;
    @track isOpenButton = false;
    @track isDeclinedButton = false;
    @track isReceivedButton = false;
    @track isIndicationButton =false;
    @track removeSectionCoverages = false;
    @track mapValue = new Map();
    @track showDeleteModal = false;
    @track oppId;
    @track opp

    @track showToastError = false;
    @track showToastMessage = [];
    @track showToastErrorAccept = false;
    @track showToastMessageAccept = [];
    @track exitCoverages = [];
    
    @api recordIsScale;
    @api recordIsHB;

    @track visualForceURL;

    @api recordId;
    @api locationState;
    @api quoteData = [];
    @track isAscendQuote;
    @track isAscend;

    isReceivedQuote;
    coverageArray;
    coverageWithLimits;
    coverageLoaded = false;

    isNewPropertyEnabled = false;

    @api
    get disableSaveButton() {
        return this.loadSpinner;
    }

    connectedCallback() {
        this.isAscendQuote = false;
        this.isAscend = false;
        console.log(this.recordId);
        
        getExistCoveragesQuote({qte: this.recordId}).then(rst => {
            this.exitCoverages = rst;
        });
        this.loadGetInfo();

        this.visualforceURL = "/apex/MultiAttachment?id=" + this.recordId;

        this.obtainCoverageWithLimits();
        
    }

    loadGetInfo(){
        getInfo({quoteId: this.recordId}).then(data => {
            this.changeButtonsLayout(data[0].Status__c);
            this.isNewPropertyEnabled = data[0].Is_New_Property__c || false;
            this.isReceivedQuote = data[0].Status__c == 'Received' ? true : false;
            //HERE
            this.quoteData = data;
            //console.log('--- this.quoteData ---');
            //console.log(JSON.stringify(this.quoteData));

            this.recordIsScale = this.quoteData[0].RecordType.Name.includes('Scale');

            this.recordIsHB = this.quoteData[0].RecordType.Name.includes('H&B');

            let quoteName = data[0].Name;
            isAscendQuote({name: quoteName}).then(result=>{
                console.log('=====after Ascned');
                console.log('=====Result'+result);
                if (result) {
                    this.isAscendQuote = true;
                    console.log('==========IS ASCEND QUOTE'+this.isAscendQuote);
                }
            });
            
            this.oppId = '/' + data[0].Opportunity__c;
            this.opp = data[0].Opportunity__c;
            this.locationState = data[0].Account_Location_State__c;
            
        })
    }

    /*async obtainCoverageWithLimits() {
        let mapOfQuoteCoverageLinksByCoverageName = new Map();
        this.coverageArray = await getCoverages({qte: this.recordId});

        if (this.coverageArray != null) {
            let fieldSets = this.coverageArray.map(e => e.Field_Set_for_Quote__c);
            
            let listOfCoverageNames = [];
    
            this.coverageArray.forEach(element => {
                listOfCoverageNames.push(element.Name);
            });
            
            let fieldSetWrapper = await getCoverageLinkFieldSetLightning({objectName :'Quote_Coverage_Link__c', coverageFieldSetName: fieldSets});
    
            let objectResponse = await getQuoteCoverageLinks({listOfCoverageNames: listOfCoverageNames, quoteId: this.recordId});

            let mapResponse = new Map();
    
            Object.keys(objectResponse).forEach(key => {
                mapResponse.set(key, objectResponse[key]);
            });
            
            
            const allowedFieldsMap = new Map();
            const fieldTypeByFieldAPIName = new Map();

            fieldSetWrapper.forEach(obj => {
                obj.fieldSet.forEach(fieldObj => {
                    allowedFieldsMap.set(fieldObj.fieldAPIName, fieldObj.fieldLabel);
                    fieldTypeByFieldAPIName.set(fieldObj.fieldAPIName, fieldObj.fieldType);
                });
            });
    
            for (const [coverageName, coverageArray] of mapResponse.entries()) {
                const filteredArray = coverageArray.map(record => {
                    const fieldsArray = [];
            
                    if (record.hasOwnProperty('Id')) {
                        fieldsArray.push({
                            key: 'Id',        
                            value: record.Id,
                            name: 'Id'
                        });
                    }
            
                    for (const key in record) {
                        if (allowedFieldsMap.has(key)) {
                            fieldsArray.push({
                                key: allowedFieldsMap.get(key),
                                value: record[key],             
                                name: key,
                                fieldType: fieldTypeByFieldAPIName.get(key)
                            });
                        }
                    }
                    return fieldsArray;
                });
                mapOfQuoteCoverageLinksByCoverageName.set(coverageName, filteredArray);
            }
            
            const coverageWithLimitsAux = [];
            this.coverageWithLimits = [];

            mapOfQuoteCoverageLinksByCoverageName.forEach((value, key) => {
                coverageWithLimitsAux.push({[key]: value[0]})
            });

            this.coverageWithLimits = coverageWithLimitsAux;
            this.coverageLoaded = true;
            //console.log('this.coverageLoaded ---> '+this.coverageLoaded);
        } else {
            this.coverageLoaded = true;
        }

    }*/
    async obtainCoverageWithLimits() {
        let mapOfQuoteCoverageLinksByCoverageName = new Map();
        this.coverageArray = await getCoverages({qte: this.recordId});

        if (this.coverageArray != null) {
            let fieldSets = this.coverageArray.map(e => e.Field_Set_for_Quote__c);

            let listOfCoverageNames = [];
            this.coverageArray.forEach(element => {
                listOfCoverageNames.push(element.Name);
            });

            let fieldSetWrapper = await getCoverageLinkFieldSetLightning({
                objectName: 'Quote_Coverage_Link__c',
                coverageFieldSetName: fieldSets
            });

            const allowedFieldsByCoverage = new Map();       
            const fieldTypesByCoverage = new Map();          

            fieldSetWrapper.forEach(fs => {
                const coverageLabel = fs.fieldSetLabel ?? fs.fieldSetName;
                const allowedMap = new Map();
                const typeMap = new Map();
                fs.fieldSet.forEach(fieldObj => {
                    allowedMap.set(fieldObj.fieldAPIName, fieldObj.fieldLabel);
                    typeMap.set(fieldObj.fieldAPIName, fieldObj.fieldType);
                });
                allowedFieldsByCoverage.set(coverageLabel, allowedMap);
                fieldTypesByCoverage.set(coverageLabel, typeMap);
            });

            let objectResponse = await getQuoteCoverageLinks({
                listOfCoverageNames: listOfCoverageNames,
                quoteId: this.recordId
            });

                let mapResponse = new Map();
                Object.keys(objectResponse).forEach(key => {
                mapResponse.set(key, objectResponse[key]);
                });

                const NUMERIC_TYPES = new Set(['CURRENCY', 'DOUBLE', 'INTEGER', 'PERCENT', 'LONG', 'DECIMAL', 'NUMBER']);

                for (const [coverageName, coverageArray] of mapResponse.entries()) {
                const allowedFieldsMap = allowedFieldsByCoverage.get(coverageName) ?? new Map();
                const typeMap = fieldTypesByCoverage.get(coverageName) ?? new Map();

                const filteredArray = coverageArray.map(record => {
                    const fieldsArray = [];

                    if (record.hasOwnProperty('Id')) {
                    fieldsArray.push({ key: 'Id', value: record.Id, name: 'Id' });
                    }

                    allowedFieldsMap.forEach((label, apiName) => {
                    const fieldType = typeMap.get(apiName);
                    let value = record[apiName];

                    if (value == null) {
                        value = NUMERIC_TYPES.has(fieldType) ? 0 : '';
                    }

                    fieldsArray.push({
                        key: label,
                        value: value,
                        name: apiName,
                        fieldType: fieldType
                    });
                });

                    return fieldsArray;
                });

                mapOfQuoteCoverageLinksByCoverageName.set(coverageName, filteredArray);
                }

                const coverageWithLimitsAux = [];
                this.coverageWithLimits = [];

                mapOfQuoteCoverageLinksByCoverageName.forEach((value, key) => {
                coverageWithLimitsAux.push({ [key]: value[0] });
                });

                this.coverageWithLimits = coverageWithLimitsAux;
                this.coverageLoaded = true;
                console.log('--- this.coverageWithLimits ---');
                console.log(this.coverageWithLimits);
            } else {
                this.coverageLoaded = true
            };
    }


    changeModal(){
        this.showCloneModal = !this.showCloneModal;
    }
    
    
    navigateToViewQuote(e){
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: e,
                objectApiName: 'Quote__c',
                actionName: 'view'
            }
        });
    }

    reloadViewPage(event){
        console.log('HERE------------');
        let value = event.detail;
        this.handleCancel();
    }

    reloadViewAcceptedPage(event){
        console.log('Reload Accepted View-----------');
        let value = event.detail;
        this.spinner=true;
        //this.changeButtonsLayout('Accepted');
        window.location.reload();
        this.spinner=false;
        //this.navigateToViewQuote(this.recordId);
    }
    

    changeButton(e){
        this.isAcceptedButton = e.detail;
    }

    deleteModal(){
        this.showDeleteModal = !this.showDeleteModal
    }

    deleteQuoteRedirect(){
        deleteQuote({recordId: this.recordId})
    }

    //includeAttachments is a parameter that can take 'yes' or 'no' values
    cloneQuoteRecord(includeAttachments) {
        this.loadSpinner = true;
        getExistCoveragesQuote({qte: this.recordId})
            .then(rst => {
                cloneRecord({quoteId: this.recordId, attach: includeAttachments, exCoverages: rst})
                    .then(rst => {
                        this.recordId = rst;
                        this.dispatchEvent(
                            new ShowToastEvent({
                                title: 'Success',
                                variant: 'success',
                            }),
                        );
                        window.location.href  = '/'+this.recordId;
                    })
                    .catch(error => {
                        let errorMessage = 'There was an error. ';
                        if (error.body && error.body.pageErrors) {
                            for (let i = 0; i < error.body.pageErrors.length; i++) {
                                errorMessage += error.body.pageErrors[i].message;
                            }
                        } else {
                            errorMessage += JSON.stringify(error);
                        }
                        this.dispatchEvent(
                                new ShowToastEvent({
                                    title: 'Updating error',
                                    message: errorMessage,
                                    variant: 'error',
                                }),
                            );
                    })
                    .finally(() => {
                        this.loadSpinner = false;
                    });

            })
            .catch(error => {
                JSON.stringify('--- ERROR ---');
                JSON.stringify(JSON.stringify(error));
            })
            .finally(() => {

            })

        this.changeModal();
    }

    saveWithAtt() {
        this.cloneQuoteRecord('yes');
        /* this.loadSpinner = true;
        getExistCoveragesQuote({qte: this.recordId})
            .then(rst => {
                cloneRecord({quoteId: this.recordId, attach: 'yes', exCoverages: rst})
                    .then(rst => {
                        this.recordId = rst;
                        this.dispatchEvent(
                            new ShowToastEvent({
                                title: 'Success',
                                variant: 'success',
                            }),
                        );
                        window.location.href  = '/'+this.recordId;
                    })
                    .catch(error => {
                        let errorMessage = 'There was an error. ';
                        if (error.body && error.body.pageErrors) {
                            for (let i = 0; i < error.body.pageErrors.length; i++) {
                                errorMessage += error.body.pageErrors[i].message;
                            }
                        } else {
                            errorMessage += JSON.stringify(error);
                        }
                        this.dispatchEvent(
                                new ShowToastEvent({
                                    title: 'Updating error',
                                    message: errorMessage,
                                    variant: 'error',
                                }),
                            );
                    })
                    .finally(() => {
                        this.loadSpinner = false;
                    });

            })
            .catch(error => {
                JSON.stringify('--- ERROR ---');
                JSON.stringify(JSON.stringify(error));
            })
            .finally(() => {

            })

        this.changeModal(); */

    }

    saveWithoutAtt() {
        this.cloneQuoteRecord('no');
        /* this.loadSpinner = true;
        getExistCoveragesQuote({qte: this.recordId})
            .then(rst => {
                cloneRecord({quoteId: this.recordId, attach: 'no', exCoverages: rst})
                    .then(rst => {
                        console.log(rst);
                        this.recordId = rst;
                        this.dispatchEvent(
                            new ShowToastEvent({
                                title: 'Success',
                                variant: 'success',
                            }),
                            );
                            window.location.href  = '/'+this.recordId;
                    })
                    .catch(error => {
                        let errorMessage = 'There was an error. ';
                        if (error.body && error.body.pageErrors) {
                            for (let i = 0; i < error.body.pageErrors.length; i++) {
                                errorMessage += error.body.pageErrors[i].message;
                            }
                        } else {
                            errorMessage += JSON.stringify(error);
                        }
                        JSON.stringify('--- errorMessage ---');
                        JSON.stringify(JSON.stringify(errorMessage));
                        this.dispatchEvent(
                                new ShowToastEvent({
                                    title: 'Updating error',
                                    message: errorMessage,
                                    variant: 'error',
                                }),
                            );
                    })
                    .finally(() => {
                        this.loadSpinner = false;
                    });
            })
            .catch(error => {
                JSON.stringify('--- ERROR ---');
                JSON.stringify(JSON.stringify(error));
            })
            .finally(() => {

            })

        this.changeModal(); */

    }

    handleRejectQuote(){
        this.template.querySelector('c-reject-quote-component').rejectQuote();
    }

    handleEditClick(){
        this.isEdit = true;
        this.isUpdateQuote = false;
        this.isAddorRemoveCov = false;
        this.isAcceptQuote = false;
        this.isRejectQuote = false;
        this.isView = false;
        this.showToastError = false;
        this.removeSectionCoverages = false;
    }

    messageEvent(e) {
        this.showToastError = e.detail.showToastError;
        this.showToastMessage = e.detail.showToastMessage;
        if(e.detail.saveItem == true) {
            this.handleUpdate();
        }
    }
    messageEventAcc(e){
        this.showToastErrorAccept = e.detail.showToastError;
        this.showToastMessageAccept = e.detail.showToastMessage;
        // if(e.detail.saveItem == true){
        //     this.handleUpdate();
        // }
    }

    handleAddorRemoveCov(){
        this.isEdit = false;
        this.isAddorRemoveCov = true;
        this.isUpdateQuote = false;
        this.isAcceptQuote = false;
        this.removeSectionCoverages = false;
        this.isRejectQuote = false;
        this.isView = false;
    }
    cancelAddEvent(){
        
    }

    handleUpdateClick(){
        this.isEdit = false;
        this.isAddorRemoveCov = false;
        this.isUpdateQuote = true;
        this.isAcceptQuote = false;
        this.removeSectionCoverages = false;
        this.isRejectQuote = false;
        this.isView = false;
    }
    handleRejectClick(){
        this.isEdit = false;
        this.isRejectQuote = false;
        this.isAddorRemoveCov = false;
        this.isAcceptQuote = false;
        this.isRejectQuote = true;
        this.removeSectionCoverages = false;
        this.isView = false;
    }

    test(e){
        console.log(e.detail);
        this.testlimitsave = e.detail;
        this.mapValue = JSON.parse(this.testlimitsave);
        for (let i = 0; i < this.mapValue.length; i++) {
            this.allMapValue.set(this.mapValue[i][0],this.mapValue[i][1])
        }
    }
    handleEditAcceptQuote(){
        this.isEdit = false;
        this.removeSectionCoverages = false;
        this.isRejectQuote = false;
        this.isUpdateQuote = false;
        this.isAddorRemoveCov = false;
        this.isView = false;
        this.isAcceptQuote = true;
    }
    
    removeSection(){
        this.isEdit = false;
        this.isRejectQuote = false;
        this.isUpdateQuote = false;
        this.isAddorRemoveCov = false;
        this.removeSectionCoverages = true;
        this.isView = false;
        this.isAcceptQuote = false; 
    }


    handleReloadView(event) {
        
       /* this.isEdit = false;
        this.isUpdateQuote = false;
        this.isAddorRemoveCov = false;
        this.isRejectQuote = false;
        this.isView = true;
        this.showToastError = false;
        this.removeSectionCoverages = false;
        this.isAcceptQuote = false;
        */

        if (event.detail != null) {
            if (event.detail.title == 'Error') {
                this.showToastMessage.push(event.detail.message);
                this.showToastError = true;
            }
        } else {
            this.showToastError = false;
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Success ',
                    message: 'Limits saved',
                    variant: 'Success',
                }),
            );
            window.location.reload();
        }
        
    }

    handleAcceptedView(){
        this.isAcceptedButton = true;
        this.loadGetInfo();
        /*this.isEdit = false;
        this.isAddorRemoveCov = false;
        this.isUpdateQuote = false;
        this.isView = true;
        this.showToastError = false;
        this.removeSectionCoverages = false;
        this.isAcceptQuote = false;*/

    }
    
    handleCancel(){
        this.loadGetInfo();
        this.showToastErrorAccept = false;
        this.showToastMessageAccept =[];
        this.isEdit = false;
        this.isUpdateQuote = false;
        this.isAddorRemoveCov = false;
        this.isRejectQuote = false;
        this.isView = true;
        this.showToastError = false;
        this.removeSectionCoverages = false;
        this.isAcceptQuote = false;
        
    }
    // addNewCoverages(){
    //     this.isAddorRemoveCov = true;
        
    // }
    handleSaveAccept(){
        let objToSave = [];
       // console.log(this.mapValueLim);

        for (let key of this.mapValueLim) {
            let map = new Map();
            for (let mapKey of key[1]) {
                map.set( mapKey[0], mapKey[1])
            }
            let obj = Array.from(map).reduce((obj, [key, value]) => (
                Object.assign(obj, { [key]: value })
              ), {});
              objToSave.push(obj)
            // console.log(map);
            // console.log(obj);
        }
        console.log(objToSave);
        saveLimit({qteCov: objToSave});
       this.template.querySelector('c-quote-accept-component').acceptQuoteRecord();

       //window.location.reload();
    //    this.template.querySelector('c-quote-edit-component').HandleLimitSave();
        // let mapToObj = Array.from(this.allMapValue).reduce((mapToObj, [key, value]) => {
        //     mapToObj[key] = value;
        //     return mapToObj;
        // }, {

        // });
        //let stringtest = JSON.parse(this.allMapValue);
        // mapValue = JSON.parse(this.testlimitsave);
        // console.log(mapToObj);

    }

    handleSaveAcceptSucc(){
        this.handleAcceptedView();
        this.handleCancel();
    }

    saveItem(e){
        let JsonMap = JSON.parse(e.detail);
        this.mapValueLim.set(JsonMap[1][1],JsonMap)
        //console.log(JsonMap);

        //console.log(this.mapValueLim);

        // let mapValueItem = new Map();
        // let mapKey = JSON.parse(e.detail);
        // let mapValue = JSON.parse(mapKey[0][1])
        // for (let i = 0; i < mapValue.length; i++) {
        //     mapValueItem.set(mapValue[i][0],mapValue[i][1])
        //     console.log(mapValueItem);
        // }
        // this.mapValueLim.set(mapKey[0][0],mapValueItem)
        // // console.log(mapKey);
        // // console.log(mapValue);
        // // console.log(mapValueItem);
        // console.log(this.mapValueLim);


    }
    
    handleSave(){
        this.loadSpinner = true;
        let validations = this.template.querySelector('c-quote-edit-component').validateIndicationStatus();
        if (validations) {
            this.loadSpinner = false;
            return;
        }
        
        this.onsave = true;
        try {
            this.template.querySelector('c-quote-edit-component').updateRecord()
                .then(() =>{
                    this.template.querySelector('c-quote-view-component').reloadComponent()
                        .then(() => {
                            this.loadGetInfo()
                            .then(() =>{
                                this.loadSpinner = false;
                            })
                            .catch(error => {
                                this.loadSpinner = false;                         
                            });
                        })
                        .catch(error => {
                            this.loadSpinner = false;                     
                        });
                })
                .catch(error => {
                    this.loadSpinner = false;
                });
        } catch(error) {
            console.log(JSON.stringify(error));
            this.loadSpinner = false;
        }
        this.obtainCoverageWithLimits();
        //this.loadSpinner = false;
        
    //    this.handleUpdate();
    //    .then(()=>{
    //         this.handleUpdate();
    //         this.showToastError = false;
    //         this.showToastMessage = '';
    //    })


    }
    saveRestore(){
       this.onsave = false
    }
    changeButtonsLayout(status){
        setTimeout(() => {
            if(status == 'Accepted' && status != null){
                this.isAcceptedButton = true;
                this.isOpenButton = false;
                this.isReceivedButton = false;
                this.isOpenButton = false;
                this.isDeclinedButton = false;
                this.isIndicationButton = false;
            }else if(status == 'Open' && status != null){
                this.isOpenButton = true
                this.isAcceptedButton = false;
                this.isReceivedButton = false;
                this.isDeclinedButton = false;
                this.isIndicationButton = false;
            }else if(status == 'Received' && status != null){
                this.isReceivedButton = true
                this.isAcceptedButton = false;
                this.isOpenButton = false;
                this.isDeclinedButton = false;
                this.isIndicationButton = false;
            }else if(status   == 'Rejected' && status != null){
                this.isOpenButton = true;
                this.isAcceptedButton = false;
                this.isReceivedButton = false;
                this.isDeclinedButton = false;
                this.isIndicationButton = false;
            }else if(status == 'Declined' && status != null){
                this.isDeclinedButton = true
                this.isAcceptedButton = false;
                this.isOpenButton = false;
                this.isReceivedButton = false;
                this.isIndicationButton = false;
            }
            else if(status == 'Indication' && status != null){
                this.isDeclinedButton = false;
                this.isAcceptedButton = false;
                this.isOpenButton = false;
                this.isReceivedButton = false;
                this.isIndicationButton = true;
            }
        }, 1000);

    }

    changeVisibility(event){
        this.changeButtonsLayout(event.detail[0].status);
        console.log('------------CHANGE VISIBILITY-----------------'+event.detail[0].status);
    }

    handleUpdate(){
        // this.isEdit = false;
        // this.isView = true;
        this.isEdit = false;
        this.isRejectQuote = false;
        this.isAddorRemoveCov = false;
        this.removeSectionCoverages = false;
        this.isRejectQuote = false;
        this.isView = true;
        this.isAcceptQuote = false;
        console.log('------------ HANDLE UPDATE HERE');

    }

    handleUpdateAcceptQuote(){
        // this.isAcceptQuote = false;
        // this.isView = true;
        this.isEdit = false;
        this.isRejectQuote = false;
        this.isAddorRemoveCov = false;
        this.isRejectQuote = false;
        this.isView = true;
        this.removeSectionCoverages = false;
        this.isAcceptQuote = false;
    }

    async handleAddCurrentProposal() {
        try {
            if (this.recordId) {
                let toastWrapper = await addToCurrentProposal({ recordId: this.recordId });
                console.log(JSON.stringify('--- toastWrapper ---'));
                console.log(JSON.stringify(toastWrapper));
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: toastWrapper.title,
                        message: toastWrapper.message,
                        variant: toastWrapper.variant
                    }),
                );
            }
        } catch(error) {
            console.log(JSON.stringify(error));
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    variant: 'error',
                    message: JSON.stringify(error)
                }),
            );
        }
    }

    
}
