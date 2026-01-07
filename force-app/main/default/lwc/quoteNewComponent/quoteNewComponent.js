import { LightningElement,track, api, wire } from 'lwc';
import isScaleOpp from '@salesforce/apex/QuoteController.isScaleOpp';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class QuoteNewComponent extends LightningElement {

    @api recordId;
    @api newid;
    // @api recordId = '006P0000009TuaIIAS';
    @track redirectQuote = false;
    @track quoteAddCoverage = false;
    @track addQuoteInfo = false;
    @track infoViewPage = false;
    @api limitToQuote;
    @track coveragesToSend;
    @track newQuoteId;
    @track showSelectRaterType = false;
    @track isScale = false;
    @api selectedRaterType;

    connectedCallback(){
        console.log('-----> '+this.recordId);
        //console.log('Opp Id -> ', this.oppId);

        isScaleOpp({
            oppId: this.recordId
        }).then(oppIsScale => {
            this.isScale = oppIsScale;
            this.quoteAddCoverage = !this.isScale;
            this.showSelectRaterType = this.isScale;
        })
    }
    
    
    raterTypeChangeHandler(event) {
        console.log('event.detail', event.detail);
        this.selectedRaterType = event.detail;
        this.quoteAddCoverage = true;
        this.showSelectRaterType = false;
    }

    handlePrevious() {
        console.log('previous', this.recordId);
        isScaleOpp({
            oppId: this.recordId
        }).then(oppIsScale => {
            this.isScale = oppIsScale;
            this.quoteAddCoverage = !this.isScale;
            this.showSelectRaterType = this.isScale;
        })
    }

    nextView(){
        // this.redirectQuote = false;
        this.quoteAddCoverage = !this.isScale;
        this.addQuoteInfo = false;
        this.infoViewPage = false;
    }
    infoView(e){
        // this.redirectQuote = false;
        this.quoteAddCoverage = false;
        this.addQuoteInfo = false;
        this.infoViewPage = true;
        this.newQuoteId = e.detail;

    }
    cancelEvent(){
        // this.redirectQuote = true;
        this.quoteAddCoverage = true;
        this.addQuoteInfo = false;
        this.infoViewPage = false;

    }
    itemreceived(e){
        console.log(e.detail);
    }
    addQuoteInfoView(e){
        this.limitToQuote = e.detail;
        this.quoteAddCoverage = false;
        this.addQuoteInfo = true;
        this.infoViewPage = false;

    }

    handleError(event) {
        const errorEvent = event;
        console.log('--- event ---');
        console.log(JSON.stringify(event));
        if (errorEvent.detail.showToastError == true) {
            const toastEvent = new ShowToastEvent({
                title: 'Error',
                message: errorEvent.detail.showToastMessage[0],
                variant: 'error'
            });
            this.dispatchEvent(toastEvent);
        }
    }
}