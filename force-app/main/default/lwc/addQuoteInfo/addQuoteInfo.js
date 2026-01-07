import {
    LightningElement,
    api,
    track,
    wire
} from 'lwc';
// import getInfo from '@salesforce/apex/QuoteController.getInformation';
import {
    getObjectInfo
} from 'lightning/uiObjectInfoApi';
import {
    ShowToastEvent
} from 'lightning/platformShowToastEvent';
import OPPORTUNITY from '@salesforce/schema/Opportunity';
import fetchPickListValue from '@salesforce/apex/QuoteController.fetchPickListValue';
import fetchPickListEntries from '@salesforce/apex/QuoteController.fetchPickListEntries';
import editQuote from '@salesforce/apex/QuoteController.editQuote';

import saveQuote from '@salesforce/apex/QuoteController.saveQuote';
import saveNewLimit from '@salesforce/apex/QuoteController.saveNewLimit';
import {
    updateRecord
} from 'lightning/uiRecordApi';
import {
    NavigationMixin
} from 'lightning/navigation';

import apexSearch from '@salesforce/apex/QuoteController.search';
import apexSearchAcc from '@salesforce/apex/QuoteController.searchAcc';
import searchOpp from '@salesforce/apex/QuoteController.searchOpp';
import getNameOpp from '@salesforce/apex/QuoteController.getNameOpp';
import isScaleOpp from '@salesforce/apex/QuoteController.isScaleOpp';
import isHBOpp from '@salesforce/apex/QuoteController.isHBOpp';

export default class AddQuoteInfo extends NavigationMixin(LightningElement) {

    @api notifyViaAlerts = false;

    @track mapValue = new Map();
    @track initialMap = new Map();
    @track mapLimits = new Map();

    @track PFA_Type;
    @track PFA_TypeView = true;
    @api selectedRaterType;

    isMultiEntry = false;
    maxSelectionSize = 2;

    initialSelection = [];
    secondaryInitialSelection = [];
    carrierInitialSelection = [];
    producerInitialSelection = [];

    errors = [];
    secondaryErrors = [];
    carrierErrors = [];


    REASON_FOR_DECLINATION_OPTIONS = [];
    reasonForDeclination;
    @track statusOptions = [];
    @api coverages;
    @api recordId;
    @track dataInfo = [];
    @track dataPricing = [];
    @track mapObjectInfo;
    @track marketer;
    @track marketerName;
    @track opp;
    @track oppName;
    @track oppUrl;
    @track carrier;
    @track carrierName;
    @track status;
    @track defStatus = 'Open';
    @track carrierEdit = false;
    @track marketerEdit = false;
    @track seconMarketerEdit = false;
    @track isScale = false;

    @track isHBQuote = false;
    @track isAdditionalInfo = false;
    @track option = [];
    @track valueDual = [];
    @track statusField = [];
    @track statusFieldA = [];
    @track blanketField = [];
    @track blanketFieldA = [];
    @track retroField = [];
    @track retroFieldA = [];
    @track followField = [];
    @track followFieldA = [];
    @track billingField = [];
    @track formTypeField = [];
    @track admittedField = [];
    @track loadSpinner = false;

    @track showToastError = false;
    @track showToastMessage = [];

    @track showNewModal = false;
    @track showNewModalAcc = false;
    @track showNewModalSec = false;
    showNewModalProducerName = false;
    @track contacts;
    @track contactsSearch = '';
    @track oppSearch = '';

    @track oppModal = false;
    isStatusDeclined = false;

    connectedCallback() {
        try {
            let mNames = new Map();
            this.mapValue.set('Opportunity__c', this.recordId);
            this.mapValue.set('Autocalc_Taxes_And_Fees__c', true);

            isScaleOpp({
                oppId: this.recordId
            }).then(rst => {
                this.isScale = rst;
                isHBOpp({
                    oppId: this.recordId
                }).then(rst => {
                    this.isHBQuote = rst;
                    console.log('h&b', rst)
                    if (this.isHBQuote || this.isScale) {
                        this.isAdditionalInfo = false;
                    } else {
                        this.isAdditionalInfo = true;
                    }
                    console.log('isAdditionalInfo', this.isHBQuote, this.isScale, this.isAdditionalInfo);
                    ////
                })
            })

            getNameOpp({
                opp: this.recordId
            }).then(rst => {
                this.oppName = rst;
                this.oppUrl = '/' + this.recordId;
            })

            /* fetchPickListValue({
                objInfo: {
                    'sobjectType': 'Quote__c'
                },
                picklistFieldApi: 'Status__c'
            }).then(data => {
                this.statusField = data;
                let apiname = 'Status__c';
                let valueField = 'Open';
                this.mapValue.set(apiname, valueField);
            });
            fetchPickListValue({
                objInfo: {
                    'sobjectType': 'Quote__c'
                },
                picklistFieldApi: 'PFA_Type__c'
            }).then(data => {
                this.PFA_Type = data;
            });
            fetchPickListValue({
                objInfo: {
                    'sobjectType': 'Quote__c'
                },
                picklistFieldApi: 'Blanket_AI__c'
            }).then(data => {
                this.blanketField = data;
                for (let i = 0; i < data.length; i++) {
                    this.option.push({
                        label: data[i].slabel,
                        value: data[i].svalue,
                    });
                    this.initialMap.set(data[i].slabel, data[i].svalue)
                }
            });
            fetchPickListValue({
                objInfo: {
                    'sobjectType': 'Quote__c'
                },
                picklistFieldApi: 'Retro_Date_Type__c'
            }).then(data => {
                this.retroField = data;
            });
            fetchPickListValue({
                objInfo: {
                    'sobjectType': 'Quote__c'
                },
                picklistFieldApi: 'Follow_form__c'
            }).then(data => {
                this.followField = data;
            });
            fetchPickListValue({
                objInfo: {
                    'sobjectType': 'Quote__c'
                },
                picklistFieldApi: 'Billing__c'
            }).then(data => {
                this.billingField = data;
            });
            fetchPickListValue({
                objInfo: {
                    'sobjectType': 'Quote__c'
                },
                picklistFieldApi: 'Form_Type__c'
            }).then(data => {
                this.formTypeField = data;
            });
            fetchPickListValue({
                objInfo: {
                    'sobjectType': 'Quote__c'
                },
                picklistFieldApi: 'Admitted__c'
            }).then(data => {
                this.admittedField = data;
            });
            fetchPickListValue({
                objInfo: {
                    'sobjectType': 'Quote__c'
                },
                picklistFieldApi: 'Status__c'
            }).then(data => {
                this.statusOptions = data;
            });
            

            fetchPickListValue({
                objInfo: {
                  sobjectType: "Quote__c"
                },
                picklistFieldApi: "Reason_for_Declination__c"
              }).then((data) => {
                for (let i = 0; i < data.length; i++) {
                  this.REASON_FOR_DECLINATION_OPTIONS.push({
                    label: data[i].slabel,
                    value: data[i].svalue
                  });

                }
                this.mapValue.set("Reason_for_Declination__c", null);
              }); */

              let fieldAPIName = ['Status__c', 
                'Shared_Limts__c', 
                'PFA_Type__c', 
                'Retro_Date_Type__c', 
                'Follow_form__c', 
                'API_Quote_Source__c', 
                'Billing__c', 
                'Form_Type__c', 
                'Admitted__c', 
                'Blanket_AI__c',
                'Reason_for_Declination__c'];
    
            fetchPickListEntries({ objInfo: { 'sobjectType': 'Quote__c' }, listPicklistFieldApi: fieldAPIName })
                .then(data => {
                    console.log('--- JSON.stringify(data) ---');
                    console.log(JSON.stringify(data));
    
                    let result = new Map();
                    Object.keys(data).forEach(key => {
                        result.set(key, data[key]);
                    });
    
                    /* this.statusField = result.get('Status__c'); */
                    this.sharedField = result.get('Shared_Limts__c');
                    this.PFA_Type = result.get('PFA_Type__c');
                    this.retroField = result.get('Retro_Date_Type__c');
                    this.follumField = result.get('Follow_form__c');
                    this.apiQuoteSource = result.get('API_Quote_Source__c');
                    this.billingField = result.get('Billing__c');
                    this.formTypeField = result.get('Form_Type__c');
                    this.admittedField = result.get('Admitted__c');
                    this.blanketField = result.get('Blanket_AI__c');
    
                    for (let i = 0; i < this.blanketField.length; i++) {
                        this.option.push({
                            label: this.blanketField[i].slabel,
                            value: this.blanketField[i].svalue,
                        });
                        this.initialMap.set(this.blanketField[i].slabel, this.blanketField[i].svalue)
                    }
    
                    let reasonForDeclinationOptions = result.get('Reason_for_Declination__c');
    
                    for (let i = 0; i < reasonForDeclinationOptions.length; i++) {
                        this.REASON_FOR_DECLINATION_OPTIONS.push({
                            label: reasonForDeclinationOptions[i].slabel,
                            value: reasonForDeclinationOptions[i].svalue
                        });
                    }

                    let statusOptions = result.get('Status__c');

                    for (let i = 0; i < statusOptions.length; i++) {
                        if (statusOptions[i].svalue != 'Rejected' && statusOptions[i].svalue != 'Accepted') {
                            this.statusOptions.push( {label: String(statusOptions[i].slabel), value: String(statusOptions[i].svalue)} );
                        }
                        
                    }
    
                })
                .catch((error) => {
                    console.log('--- error ---');
                    console.log(JSON.stringify(error));
                });

              

            this.getMapName();

            this.PFA_TypeView = true;


        } catch (error) {
            console.log('this.isAdditionalInfo');
            console.log(error.linenumber);
        }

    }

    changeOpp(e) {
        let apiname = e.target.name;
        let valueField = e.target.value;
        this.mapValue.set(apiname, valueField);
        console.log(this.mapValue);
    }

    changeOppModal() {
        this.oppModal = !this.oppModal;
    }

    @api reloadComponent(newId) {
        let mNames = new Map();

        fetchPickListValue({
            objInfo: {
                'sobjectType': 'Quote__c'
            },
            picklistFieldApi: 'Status__c'
        }).then(data => {
            this.statusField = data;
        });
        fetchPickListValue({
            objInfo: {
                'sobjectType': 'Quote__c'
            },
            picklistFieldApi: 'Blanket_AI__c'
        }).then(data => {
            this.blanketField = data;
            for (let i = 0; i < data.length; i++) {
                this.option.push({
                    label: data[i].slabel,
                    value: data[i].svalue,
                });
                this.initialMap.set(data[i].slabel, data[i].svalue)
            }
        });
        fetchPickListValue({
            objInfo: {
                'sobjectType': 'Quote__c'
            },
            picklistFieldApi: 'Retro_Date_Type__c'
        }).then(data => {
            this.retroField = data;
        });
        fetchPickListValue({
            objInfo: {
                'sobjectType': 'Quote__c'
            },
            picklistFieldApi: 'Follow_form__c'
        }).then(data => {
            this.followField = data;
        });
        fetchPickListValue({
            objInfo: {
                'sobjectType': 'Quote__c'
            },
            picklistFieldApi: 'Billing__c'
        }).then(data => {
            this.billingField = data;
        });
        fetchPickListValue({
            objInfo: {
                'sobjectType': 'Quote__c'
            },
            picklistFieldApi: 'Form_Type__c'
        }).then(data => {
            this.formTypeField = data;
        });
        fetchPickListValue({
            objInfo: {
                'sobjectType': 'Quote__c'
            },
            picklistFieldApi: 'Admitted__c'
        }).then(data => {
            this.admittedField = data;
        });
        this.getMapName();
    }

    updateSeachKey(event) {
        this.contactsSearch = event.target.value;
    }
    updateOppSeach(event) {
        this.oppSearch = event.target.value;
    }
    modalSearch() {
        if (this.contactsSearch.length > 1) {
            apexSearch({
                    searchTerm: this.contactsSearch,
                    selectedIds: null
                })
                .then((results) => {
                    this.contacts = results;
                    console.log(results);
                })
                .catch((error) => {
                    console.error('Lookup error', JSON.stringify(error));
                });
        } else {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    variant: 'error',
                    message: 'Search term must be longer than one character'
                })

            )
        }
    }
    modalSearchAcc() {
        if (this.contactsSearch.length > 1) {
            apexSearchAcc({
                    searchTerm: this.contactsSearch,
                    selectedIds: null
                })
                .then((results) => {
                    this.contacts = results;
                    console.log(results);
                })
                .catch((error) => {
                    //this.notifyUser('Lookup Error', 'An error occured while searching with the lookup field.', 'error');
                    console.error('Lookup error', JSON.stringify(error));
                });
        } else {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    variant: 'error',
                    message: 'Search term must be longer than one character'
                })

            )
        }
    }
    selectOppItem(e) {
        let itemId = e.target.id;
        itemId = itemId.slice(0, -4);
        this.mapValue.set('Opportunity__c', itemId);
        getNameOpp({
            opp: itemId
        }).then(rst => {
            this.oppName = rst;
            this.oppUrl = '/' + itemId;
        })
        this.changeOppModal();
    }
    selectItem(e) {
        let itemId = e.target.id;
        let itemName = e.target.dataset.name;
        let itemSubtitle = e.target.dataset.subtitle;
        itemId = itemId.slice(0, -4);
        this.initialSelection = [{
            "id": itemId,
            "sObjectType": "Contact",
            "icon": "standard:contact",
            "title": itemName,
            "subtitle": itemSubtitle
        }];
        this.closeModal();
        this.mapValue.set('Marketer_UW_Name__c', itemId);
        this.errors = [];
        this.contacts = [];
    }

    selectItemSec(e) {
        let itemId = e.target.id;
        let itemName = e.target.dataset.name;
        let itemSubtitle = e.target.dataset.subtitle;
        itemId = itemId.slice(0, -4);
        this.secondaryInitialSelection = [{
            "id": itemId,
            "sObjectType": "Contact",
            "icon": "standard:contact",
            "title": itemName,
            "subtitle": itemSubtitle
        }];
        this.closeModal();
        this.mapValue.set('Secondary_Marketer_UW_Name__c', itemId);
        this.secondaryErrors = [];
        this.contacts = [];
    }
    selectItemProducerName(e) {
        let itemId = e.target.id;
        let itemName = e.target.dataset.name;
        let itemSubtitle = e.target.dataset.subtitle;
        itemId = itemId.slice(0, -4);
        this.producerInitialSelection = [{
            "id": itemId,
            "sObjectType": "Contact",
            "icon": "standard:contact",
            "title": itemName,
            "subtitle": itemSubtitle
        }];
        this.closeModal();
        this.mapValue.set('Producer_Name__c', itemId);
        this.contacts = [];
    }
    selectItemAcc(e) {
        let itemId = e.target.id;
        let itemName = e.target.dataset.name;
        let itemSubtitle = e.target.dataset.subtitle;
        itemId = itemId.slice(0, -4);
        this.carrierInitialSelection = [{
            "id": itemId,
            "sObjectType": "Contact",
            "icon": "standard:contact",
            "title": itemName,
            "subtitle": itemSubtitle
        }];
        this.closeModal();
        this.mapValue.set('Carrier_Issuing_Company__c', itemId);
        this.carrierErrors = [];
        this.contacts = [];
    }
    modalOppSearch() {
        if (this.oppSearch.length > 1) {
            searchOpp({
                oppName: this.oppSearch
            }).then(rst => {
                this.contacts = rst;
            })
        }
    }
    closeModal() {
        this.showNewModal = false;
        this.showNewModalSec = false;
        this.showNewModalProducerName = false;
        this.showNewModalAcc = false;
        this.contactsSearch = '';
    }
    openModal(e) {
        this.showNewModal = e.detail;
    }
    openModalProducerName(e) {
        this.showNewModalProducerName = e.detail;
    }

    openModalSec(e) {
        this.showNewModalSec = e.detail;
    }
    openModalAcc(e) {
        this.showNewModalAcc = e.detail;
    }
    handleLookupTypeChange(event) {
        this.initialSelection = [];
        this.errors = [];
        this.isMultiEntry = event.target.checked;
    }

    handleCancel() {
        const selectsucces = new CustomEvent('cancelevent', {
            detail: true
        });
        this.dispatchEvent(selectsucces);

    }
    carrierHandleSearch(event) {
        apexSearchAcc(event.detail)
            .then((results) => {
                this.template.querySelector('.lookupCarr').setSearchResults(results);
            })
            .catch((error) => {
                this.notifyUser('Lookup Error', 'An error occured while searching with the lookup field.', 'error');
                this.carrierErrors = [error];
            });
    }
    secondaryHandleSearch(event) {
        apexSearch(event.detail)
            .then((results) => {
                this.template.querySelector('.lookupSecondary').setSearchResults(results);
            })
            .catch((error) => {
                this.notifyUser('Lookup Error', 'An error occured while searching with the lookup field.', 'error');
                this.secondaryErrors = [error];
            });
    }
    producerNameHandleSearch(event) {
        apexSearch(event.detail)
            .then((results) => {
                this.template.querySelector('.lookupProducerName').setSearchResults(results);
            })
            .catch((error) => {
                this.notifyUser('Lookup Error', 'An error occured while searching with the lookup field.', 'error');
            });
    }
    carrierHandleSelectionChange(e) {

        try {
            this.checkForErrors();
            const selection = this.template.querySelector('.lookupCarr').getSelection();
            if (selection[0].id != undefined) {
                this.mapValue.set('Carrier_Issuing_Company__c', selection[0].id);
            }
        } catch (error) {
            console.log(error);
        }
    }
    secondaryHandleSelectionChange() {

        try {
            this.checkForErrors();
            const selection = this.template.querySelector('.lookupSecondary').getSelection();
            if (selection[0].id != undefined) {
                this.mapValue.set('Secondary_Marketer_UW_Name__c', selection[0].id);
            }
        } catch (error) {
            console.log(error);
        }
    }

    handleSelectionChangeProducerName(e) {
        try {
            const selection = this.template.querySelector('c-lookup').getSelection();
            if (selection[0].id != undefined) {
                this.mapValue.set('Producer_Name__c', selection[0].id);
            }
        } catch (error) {
            console.log(error);
        }
    }

    handleSelectionChange(e) {
        try {
            this.checkForErrors();
            const selection = this.template.querySelector('c-lookup').getSelection();
            if (selection[0].id != undefined) {
                this.mapValue.set('Marketer_UW_Name__c', selection[0].id);
            } else {
                this.mapValue.set('Secondary_Marketer_UW_Name__c', '');
            }
        } catch (error) {
            console.log(error);
        }
    }
    handleSearch(event) {
        apexSearch(event.detail)
            .then((results) => {
                this.template.querySelector('c-lookup').setSearchResults(results);
            })
            .catch((error) => {
                this.notifyUser('Lookup Error', 'An error occured while searching with the lookup field.', 'error');
                this.errors = [error];
            });
    }
    handleSearchAcc(event) {
        console.log(event.detail);
        apexSearchAcc(event.detail)
            .then(results => {
                this.template.querySelector('#lookupCarrier').setSearchResultsAcc(results);
            })
            .catch((error) => {
                this.notifyUser('Lookup Error', 'An error occured while searching with the lookup field.', 'error');
                this.errors = [error];
            });
    }

    handleSelectionChangeAcc(e) {
        let apiname = e.target.name;
        let valueField = e.detail;
        try {
            this.mapValue.set(apiname, valueField[0].id);
        } catch (error) {
            console.log(error);
        }
    }

    handleMaxSelectionSizeChange(event) {
        this.maxSelectionSize = event.target.value;
    }



    handleSaveNewQuote() {
        let obj = Array.from(this.mapValue).reduce((obj, [key, value]) => (
            Object.assign(obj, {
                [key]: value
            }) // Be careful! Maps can have non-String keys; object literals can't.
        ), {});
        this.loadSpinner = true;
        console.log(this.mapLimits);
        console.log('--->', this.mapValue);
        if (this.mapValue.size > 3 && this.mapValue.get('Name') != undefined && this.mapValue.get('Marketer_UW_Name__c') != undefined && this.mapValue.get('Carrier_Issuing_Company__c') != undefined) {
            saveQuote({
                newQuote: obj
            }).then(rst => {
                if (this.mapLimits.size != 0) {
                    let getKeys = Array.from(this.mapLimits.keys());
                    let objectToSave = [];
                    for (let i = 0; i < getKeys.length; i++) {
                        let element = this.mapLimits.get(getKeys[i]);
                        element.set('Quote__c', rst);
                        let limit = Array.from(element).reduce((limit, [key, value]) => (
                            Object.assign(limit, {
                                [key]: value
                            }) // Be careful! Maps can have non-String keys; object literals can't.
                        ), {});
                        objectToSave.push(limit)
                    }
                    saveNewLimit({
                        newLimits: objectToSave
                    }).then(() => {

                    }).catch(error => {
                        this.dispatchEvent(
                            new ShowToastEvent({
                                title: 'Error',
                                variant: 'error',
                                message: error
                            })
                        )
                    })
                    console.log(objectToSave);
                }

                const selectsucces = new CustomEvent('infopage', {
                    detail: rst,
                });
                this.dispatchEvent(selectsucces);
                let redirecrToUrl = '/' + rst;

                this.navigateToViewQuote(rst);
            }).catch(error => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error',
                        variant: 'error',
                        message: error.body.pageErrors[0].message
                    })
                )
                this.loadSpinner = false;
            })
        } else {
            this.loadSpinner = false

            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    variant: 'error',
                    message: 'Please fill the required fields'
                })

            )
        }

    }

    navigateToViewQuote(e) {
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: e,
                objectApiName: 'Quote__c',
                actionName: 'view'
            }
        });
    }

    handleSubmit() {
        this.checkForErrors();
        if (this.errors.length === 0) {
            this.notifyUser('Success', 'The form was submitted.', 'success');
        }
    }

    handleClear() {
        this.initialSelection = [];
        this.errors = [];
    }

    checkForErrors() {
        this.errors = [];
        const selection = this.template.querySelector('c-lookup').getSelection();
        // Custom validation rule
        if (this.isMultiEntry && selection.length > this.maxSelectionSize) {
            this.errors.push({
                message: `You may only select up to ${this.maxSelectionSize} items.`
            });
        }
        // Enforcing required field
        if (selection.length === 0) {
            this.errors.push({
                message: 'Please make a selection.'
            });
        }
    }

    notifyUser(title, message, variant) {
        if (this.notifyViaAlerts) {
            // Notify via alert
            // eslint-disable-next-line no-alert
            alert(`${title}\n${message}`);
        } else {
            // Notify via toast
            const toastEvent = new ShowToastEvent({
                title,
                message,
                variant
            });
            this.dispatchEvent(toastEvent);
        }
    }
    changeEdit(event) {
        let apiname = event.target.name;
        if (apiname === 'Carrier_Issuing_Company__c') {
            this.carrierEdit = true
        } else if (apiname === 'Marketer_UW_Name__c') {
            this.marketerEdit = true;
        } else if (apiname === 'Secondary_Marketer_UW_Name__c') {
            this.seconMarketerEdit = true;
        }
    }
    changeValueCheck(event) {
        let apiname = event.target.name;
        let valueField = event.target.checked;
        this.mapValue.set(apiname, valueField);
    }
    maplimitsvalue(e) {
        let map = JSON.parse(e.detail)
        let object = new Map();

        for (let i = 0; i < map.length; i++) {
            for (let e = 0; e < map[i].length; e++) {
                object.set(map[i][0], map[i][1])
            }
        }
        this.mapLimits.set(map[0][1], object)
    }
    changedual(event) {
        let apiname = event.target.dataset.name;
        let valueField = event.target.value;

        let valuemap = valueField.toString().replace(/,/g, '; ');
        if (valuemap.indexOf('Mortgagee;')) {
            let newBlank = valuemap.replace('Mortgagee;', 'Mortgagee,');

            this.mapValue.set(apiname, newBlank);
        } else {
            this.mapValue.set(apiname, valueField);
        }

    }

    changeValue(event) {
        let apiname = event.target.name;
        let valueField = event.target.value;
        this.mapValue.set(apiname, valueField);
        console.log('--- handle change event ---');
        console.log(apiname);
        console.log(valueField);
        if (apiname == 'Status__c') {
            if (valueField == 'Declined') {
                this.isStatusDeclined = true;
                this.mapValue.set("Reason_for_Declination__c", this.REASON_FOR_DECLINATION_OPTIONS[0].value);
                this.reasonForDeclination = this.mapValue.get("Reason_for_Declination__c");
            } else {
                this.isStatusDeclined = false;
                this.mapValue.set("Reason_for_Declination__c", null);
            }
            
        }

        if (apiname == 'Billing__c' && valueField == 'Premium Finance Agreement') {
            this.PFA_TypeView = false;
        } else if (apiname == 'Billing__c' && valueField != 'Premium Finance Agreement') {
            this.PFA_TypeView = true;
            this.mapValue.delete('PFA_Type__c');
        }
    }

    @api
    updateRecord() {
        let obj = Array.from(this.mapValue).reduce((obj, [key, value]) => (
            Object.assign(obj, {
                [key]: value
            }) // Be careful! Maps can have non-String keys; object literals can't.
        ), {});
        editQuote({
            qte: obj
        }).then(rst => {

            if (rst == null) {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Success',
                        variant: 'success',
                    })

                )
                const selectsucces = new CustomEvent('errorevent', {
                    detail: {
                        showToastError: this.showToastError,
                        showToastMessage: this.showToastMessage,
                        saveItem: true
                    }
                });
                this.dispatchEvent(selectsucces);

                this.showToastError = false;
                this.showToastMessage = [];

            } else {
                this.showToastError = true;
                this.showToastMessage = rst;

                const selectEvent = new CustomEvent('errorevent', {
                    detail: {
                        showToastError: this.showToastError,
                        showToastMessage: this.showToastMessage,
                        saveItem: false
                    }
                });
                this.dispatchEvent(selectEvent);
            }


        })

    }
    d(event) {
        console.log('-->');

        console.log(event.detail.val);
    }
    getRecordTypeId(recordTypeName, data) {
        const recordtypeinfo = data.recordTypeInfos;
        return Object.keys(recordtypeinfo).find(rti => recordtypeinfo[rti].name == recordTypeName);
    }

    cancelEvent() {
        const selectEvent = new CustomEvent('sendevent', {
            detail: false
        });
        this.dispatchEvent(selectEvent);
    }
    getMapName() {
        for (let i = 0; i < this.dataInfo.length; i++) {
            if (this.dataInfo[i].Marketer_UW_Name__c != null) {
                this.marketerName = mNames.get(this.dataInfo[i].Marketer_UW_Name__c)
            }
            if (this.dataInfo[i].Carrier_Issuing_Company__c != null) {
                this.carrierName = mNames.get(this.dataInfo[i].Carrier_Issuing_Company__c)
            }
        }
    }

    handleChangeDeclinationReason(event){
        let apiname = event.target.name;
        let valueField = event.target.value;
        this.mapValue.set(apiname, valueField);
    }

}