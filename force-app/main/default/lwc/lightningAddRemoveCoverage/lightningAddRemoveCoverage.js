import { LightningElement, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { CloseActionScreenEvent } from "lightning/actions";
import getLightningInfo from '@salesforce/apex/QuoteController.getLightningInfo';
import getCoverageLinkFieldsDescriptionByFieldsSet from '@salesforce/apex/QuoteController.getCoverageLinkFieldSetLightning'; 
import createDummyQuote from '@salesforce/apex/QuoteController.createDummyQuote';
import saveCoverages from '@salesforce/apex/QuoteController.saveCoveragesLightning'; 

export default class LightningAddRemoveCoverage extends LightningElement {
    @api coverages = [];
    @api coveragesToUpdate;
    @api filterText = '';
    @api recordIdPageContext;
    @api selectedLimitsAtUI;
    
    @api selectedRaterType;
    
    mapOfFieldWithValuesByFieldSets = new Map();
    selectedCoverages = [];
    coveragesToDelete;
    quoteRecordId;
    policyRecordId = null;
    endorsementRecordId = null;
    fieldSet;
    sObjectType;
    _selectedRaterType;
    _recordId;
    
    firstPage = true;
    isLoading = true;
    dummyQuoteScreen;
    isNewQuoteComponent = false;
    header = "Update Coverages";
    isScale = false;

    scaleCoveragesByRaterType = {
        'MATRIX' : ['D&O', 'EPL', 'FID'],
        'EXCESS' : ['Excess D&O', 'Excess EPL', 'Excess FID', ],
        'EXOTICS' : ['D&O', 'EPL', 'FID'],
        'TECH' : ['E&O'],
        'FMP' : ['D&O', 'EPL', 'FID'],
        'ML' : ['CFI', 
                'CYB', 
                'D&O', 
                'EPL', 
                'FID', 
                'E&O', 
                'Excess D&O', 
                'Excess EPL', 
                'Excess FID',
                'Influencers Insurance',
                'FMP M&PL',
                'FMP EPL',
                'FMP FID',
                'Public D&O',
                'Lead Side A']
    }

    get filteredCoverages() {
        if (this.filterText === '') {
            return this.coverages;
        }
        return this.coverages.filter(coverage => 
            coverage.Name.toLowerCase().includes(this.filterText.toLowerCase())
        );
    }

    /* @api 
    set selectedRaterType(value) {
        this._selectedRaterType = value;
    }

    get selectedRaterType() {
        return this._selectedRaterType;
    } */

    @api 
    set recordId(value) {
        this._recordId = value;
        this.callApexMethod(this._recordId);
    }

    get recordId() {
        return this._recordId;
    }

    connectedCallback() {
        if (this.sObjectType == 'Opportunity' && this.isScale) {
            this.callApexMethod(this._recordId);
        }
    }

    callApexMethod(recordId) {
        getLightningInfo({recordId: recordId})
            .then(result => {
                this.processResponse(result);
            })
            .catch(error => {
                console.log(JSON.stringify(error))
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    processResponse(response) {
        const parsedResponse = JSON.parse(JSON.stringify(response));

        if (parsedResponse.coverages) {
            this.opportunityRecord = parsedResponse.opportunityRecord;
        }

        if (parsedResponse.acceptedQuoteWithLimits != undefined && parsedResponse.acceptedQuoteWithLimits.length != 0 && parsedResponse.acceptedQuoteWithLimits[0].Quote_Coverage_Links__r) {
            this.selectedCoverages = parsedResponse.acceptedQuoteWithLimits[0].Quote_Coverage_Links__r;
        }

        if (parsedResponse.sObjectType != 'Quote__c' && parsedResponse.sObjectType != 'Opportunity') {
            this.quoteRecordId = parsedResponse.quoteId;
            !this.quoteRecordId ? this.dummyQuoteScreen = true : this.dummyQuoteScreen = false;
        }

        if (parsedResponse.sObjectType == 'Policy__c') {
            this.sObjectType = 'Policy__c';
            this.policyRecordId = this._recordId;
            this.fillSelectedCoverages(parsedResponse);
        } else if (parsedResponse.sObjectType == 'Endorsement__c'){
            this.sObjectType = 'Endorsement__c';
            this.endorsementRecordId = this._recordId;
            this.fillSelectedCoverages(parsedResponse);
        } else if (parsedResponse.sObjectType == 'Quote__c') {
            this.sObjectType = 'Quote__c';
            this.quoteRecordId = this.recordId;
            this.selectedCoverages = parsedResponse.acceptedQuoteWithLimits[0].Quote_Coverage_Links__r;
            this.fillSelectedCoverages(parsedResponse);
        } else if (parsedResponse.sObjectType == 'Opportunity'){
            this.sObjectType = 'Opportunity';
            this.isNewQuoteComponent = true;
            this.header = 'Select Coverages';
            this.isScale = parsedResponse.isScale;
            console.log('--- selectedLimitsAtUI ---');
            console.log(this.selectedLimitsAtUI);
        }

        if(parsedResponse.coverages) {
            if (this.sObjectType == 'Opportunity'){
                this.buildListOfCoveragesOpp(parsedResponse.coverages, this.selectedLimitsAtUI);
                if (this.isScale) {
                    this.coverages = this.filterCoveragesByRaterType(this.coverages, this.selectedRaterType);

                }
            } else {
                this.buildListOfCoverages(parsedResponse.coverages);
            }
            let mapCoverageFieldSetByName = this.makeMapOfFieldSetForQuoteByQuoteCovergeLinkName(parsedResponse.coverages);
            this.fillMapWithFieldByFieldSets(parsedResponse.acceptedQuoteWithLimits[0].Quote_Coverage_Links__r, mapCoverageFieldSetByName);
        }

    }

    fillSelectedCoverages(parsedResponse) {
        if (parsedResponse.acceptedQuoteWithLimits.length != 0 && parsedResponse.acceptedQuoteWithLimits[0].Quote_Coverage_Links__r)
            this.selectedCoverages = parsedResponse.acceptedQuoteWithLimits[0].Quote_Coverage_Links__r;
    }

    fillMapWithFieldByFieldSets(coverageLinks, coverageFieldSetByName){
        for (const QCL of coverageLinks) {
            let mapOfFieldAndValues = new Map();
            for (const [key, value] of Object.entries(QCL)) {
                mapOfFieldAndValues.set(key, value);
            }
            this.mapOfFieldWithValuesByFieldSets.set(coverageFieldSetByName.get(QCL.Name), mapOfFieldAndValues);
        }
    }

    buildListOfCoverages(arrayCoverages){
        const selectedCoverages = this.selectedCoverages || [];
        const selectedNames = new Set(selectedCoverages.map(coverage => coverage.Name));

        this.coverages = arrayCoverages.map(coverage => {
            return {
                ...coverage,
                checked: selectedNames.has(coverage.Name)
            };
        });
        this.coverages.sort((a, b) => {
            if (a.checked === b.checked) {
                return 0;
            } else if (a.checked) {
                return -1;
            } else {
                return 1;
            }
        });
        
    }

    buildListOfCoveragesOpp(coverages, arrayCoverages){
        arrayCoverages = arrayCoverages || '';
        console.log('--- arrayCoverages ---');
        console.log(arrayCoverages);
        console.log('--- coverages 1 ---');
        console.log(coverages);
        
        const fieldSetNamesArray = arrayCoverages.split(',').map(name => name.trim()).filter(name => name !== '');
        const fieldSetNamesSet = new Set(fieldSetNamesArray);
        console.log('--- fieldSetNamesSet ---');
        console.log(fieldSetNamesSet);

        this.coverages = coverages.map(coverage => {
            return {
                ...coverage,
                checked: fieldSetNamesSet.has(coverage.Field_Set_for_Quote__c)
            };
        });
        console.log('--- this.coverages 4 ---');
        console.log(this.coverages);
        
        this.coverages.sort((a, b) => {
            if (a.checked === b.checked) {
                return 0;
            } else if (a.checked) {
                return -1;
            } else {
                return 1;
            }
        });

    }

    filterCoveragesByRaterType(coverages, raterType) {
        console.log('--- filterCoveragesByRaterType ---');
        if (this.scaleCoveragesByRaterType.hasOwnProperty(raterType)) {
            console.log('--- this.scaleCoveragesByRaterType.hasOwnProperty ---');

            const validNames = this.scaleCoveragesByRaterType[raterType];
            console.log('--- validNames --- ' + validNames);
            let returnCoverages = coverages.filter(coverage => validNames.includes(coverage.Name));
            console.log('--- returnCoverages ---');
            console.log(returnCoverages);
            return returnCoverages;
        }

        return [];
    }

    handleCreateDummyQuote() {
        this.isLoading = true;
        createDummyQuote({opportunityRecord: this.opportunityRecord})
            .then(result => {
                this.quoteRecordId = JSON.parse(JSON.stringify(result));
                this.dummyQuoteScreen = false;
            })
            .catch(error => {
                console.log(JSON.stringify(error))
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    addOrRemove(event) {
        let selectedCoverageName = event.target.dataset.labelname;
        
        const index = this.coverages.findIndex(coverage => coverage.Name === selectedCoverageName);
        
        if (index !== -1) {
            this.coverages[index].checked = !this.coverages[index].checked;
        }
        
    }

    changeSearch(event) {
        this.search = event.target.value;
        this.filterText = this.search;
    }

    handleNextPage() {
        this.firstPage = false;
        this.isLoading = true;

        try{
            this.coveragesToDelete = this.coverages
                .filter(coverage => !coverage.checked && this.selectedCoverages
                    .some(selected => selected.Id === coverage.Id || selected.Name === coverage.Name)
                )
                .map(coverage => {const selectedCoverage = this.selectedCoverages
                    .find(selected => selected.Id === coverage.Id || selected.Name === coverage.Name);
                        return {
                            ...coverage,
                            Id: selectedCoverage.Id
                        };
                });
        } catch(e){
            console.log(e);
        }

        let arrayOfNewFieldSetAPINamesOnly = this.coverages.filter(coverage => coverage.checked).map(coverage => coverage.Field_Set_for_Quote__c);
        this.coveragesToUpdate = this.coverages.filter(coverage => coverage.checked);

        console.log('--- arrayOfNewFieldSetAPINamesOnly ---');
        console.log(JSON.stringify(arrayOfNewFieldSetAPINamesOnly));

        this.makeTable(arrayOfNewFieldSetAPINamesOnly);

    }

    handlePrevious() {
        this.firstPage = true;
    }

    makeTable(fieldSetArray) {
        for (const selectedCoverage of this.coveragesToUpdate) {
            selectedCoverage["isExpanded"] = true;
        }

        console.log('--- fieldSetArray ---');
        console.log(JSON.stringify(fieldSetArray));

        try{
            getCoverageLinkFieldsDescriptionByFieldsSet({objectName: 'Quote_Coverage_Link__c', coverageFieldSetName: fieldSetArray})
                .then(result => {

                    console.log('--- result ---');
                    console.log(result);
                    console.log(JSON.stringify(result));
                    this.fieldSet = JSON.parse(JSON.stringify(result));
                    console.log('--- this.fieldSet ---');
                    console.log(JSON.stringify(this.fieldSet));
                    //if field set is in map mapOfFieldWithValuesByFieldSets
                    //loop the fields and add value property
                    for (const fielSet of this.fieldSet) {
                        /* fielSet["isExpanded"] = true; */
                        if (this.mapOfFieldWithValuesByFieldSets.get(fielSet.fieldSetName)) {
                            for (const field of fielSet.fieldSet) {
                                field.previousValue = this.mapOfFieldWithValuesByFieldSets.get(fielSet.fieldSetName).get(field.fieldAPIName);
                                field["quoteCoverageLinkId"] = this.mapOfFieldWithValuesByFieldSets.get(fielSet.fieldSetName).get("Id");
                            }
                        }
                    }
                    
                    for (const coverage of this.coveragesToUpdate) {
                        const correspondingFieldSet = this.fieldSet.find(fs => fs.fieldSetName == coverage.Field_Set_for_Quote__c);
                        if (correspondingFieldSet) {
                            coverage["fieldSet"] = correspondingFieldSet;
                        }
                    }
    
                })
                .catch(error => {
                    console.log(JSON.stringify(error))
                })
                .finally(() => {
                    this.isLoading = false;
                });

        } catch(e) {
            console.log(e);
        }
    }

    handleSave() {
        this.isLoading = true;
        const lightningFieldItems = this.template.querySelectorAll('c-lightning-field-item');
        const arrayOfFieldItems = Array.from(lightningFieldItems);

        if (this.checkForNegativeValues(arrayOfFieldItems)){
            this.notifyUser('Warning', 'Fix the field values before saving', 'info');
            this.isLoading = false;
            return;
        }

        if (this.checkForNullValues(arrayOfFieldItems)){
            this.notifyUser('Warning', 'Null values are not allowed', 'info');
            this.isLoading = false;
            return;
        }

        let coverageFieldItems = arrayOfFieldItems.map(item => ({
            fieldApiName: item.fieldApiName,
            value: item.value,
            fieldSetLabel: item.coverage,
            type: item.fieldType,
            quoteCoverageLinkId: item.quoteCoverageLinkId,
            quoteId: this.quoteRecordId,
            policyId: this.policyRecordId,
            endorsementId: this.endorsementRecordId
        }));

        let jsonToInsert = JSON.stringify(coverageFieldItems);
        let jsonToDelete = JSON.stringify(this.coveragesToDelete);
        let toastMessage;

        saveCoverages({newCoveragesJSON: jsonToInsert, coveragesToDeleteJSON: jsonToDelete})
            .then(result => {
                toastMessage = JSON.parse(JSON.stringify(result));
                if (this.sObjectType == 'Quote__c' && toastMessage.title == 'Success') {
                    this.sendEventToBaseComponent('savelimit', null);
                } else if (this.sObjectType == 'Quote__c' && toastMessage.title == 'Error') {
                    let detail = toastMessage.message;
                    this.sendErrorToBaseComponent('savelimit', detail);
                    this.firstPage = true;
                }
            })
            .catch(error => {
                toastMessage = JSON.parse(JSON.stringify(error));
            })
            .finally(() => {
                this.isLoading = false;
                
                if (this.sObjectType == 'Quote__c')
                    return;

                this.notifyUser(toastMessage.title, toastMessage.message, toastMessage.variant);
                this.isLoading = false;
                if (toastMessage.variant == 'success'){
                    this.handleCloseModal();
                }
            })
    }

    makeMapOfFieldSetForQuoteByQuoteCovergeLinkName(coverages){
        const coverageMap = new Map();
        coverages.forEach(coverage => {
            coverageMap.set(coverage.Name, coverage.Field_Set_for_Quote__c);
        });
        return coverageMap;
    }

    checkForNegativeValues(inputArray) {
        const excludedTypes = ['STRING', 'TEXTAREA', 'PICKLIST'];
        return inputArray.some(item => item.value < 0 && !excludedTypes.includes(item.fieldType));
    }

    checkForNullValues(inputArray) {
        return inputArray.some(item => item.fieldType !== 'BOOLEAN' && item.value == null);
    }

    handleCloseModal() {
        if (this.sObjectType == 'Quote__c'){
            this.sendEventToBaseComponent('cancelevent', true);
        } else {
            this.dispatchEvent(new CloseActionScreenEvent());
        }
    }

    notifyUser(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({title, message, variant}));
    }

    sendErrorToBaseComponent(eventName, detail) {
        const selectsucces = new CustomEvent(eventName, {
            detail: {title: 'Error', message: detail},
        });       
        this.dispatchEvent(selectsucces);
    }

    sendEventToBaseComponent(eventName, detail) {
        const selectsucces = new CustomEvent(eventName, {
            detail: detail,
        });
        this.dispatchEvent(selectsucces);
    }

    handlePreviousView(event) {
        this.dispatchEvent(new CustomEvent('previous', { }));
    }

    handleCancel() {
        const selectsucces = new CustomEvent('cancelevent', {
            detail: true
        });
        this.dispatchEvent(selectsucces);
    }

    handleNextView() {
        const selectedLimits = this.coverages.filter(coverage => coverage.checked === true).map(coverage => coverage.Field_Set_for_Quote__c);

        const selectsucces = new CustomEvent('nextaddinfo', {
            detail: selectedLimits.toString(),
        });
        this.dispatchEvent(selectsucces);
    }

}