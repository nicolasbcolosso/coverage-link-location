import { LightningElement, track, api } from "lwc";
import isScaleOpp from "@salesforce/apex/QuoteController.isScaleOpp";
import { ShowToastEvent } from "lightning/platformShowToastEvent";

export default class NewQuoteFromOpportunity extends LightningElement {
  @api recordId;

  showSelectRaterType = false;
  quoteAddCoverage = false;
  selectedRaterType;
  addQuoteInfo = false;
  infoViewPage = false;
  newQuoteId;

  limitToQuote;
  isScale = false;

  // NEW: Track if new property flow is enabled
  @track coverageDataNew = null;

  async connectedCallback() {
    console.log("opp record id ==> " + this.recordId);
    await this.checkIfScaleOpportunity();
  }

  async handlePrevious() {
    console.log("previous ==> ", this.recordId);
    await this.checkIfScaleOpportunity();
  }

  async checkIfScaleOpportunity() {
    try {
      const oppIsScale = await isScaleOpp({ oppId: this.recordId });

      this.isScale = oppIsScale;

      this.quoteAddCoverage = !this.isScale;
      this.showSelectRaterType = this.isScale;

      console.log("state info ==> ", {
        isScale: this.isScale,
        quoteAddCoverage: this.quoteAddCoverage,
        showSelectRaterType: this.showSelectRaterType
      });
    } catch (error) {
      console.error("Error checking Scale Opp ==> ", error);
      this.quoteAddCoverage = true;
    }
  }

  raterTypeChangeHandler(event) {
    console.log("rater event.detail ==> ", event.detail);

    this.selectedRaterType = event.detail;
    this.quoteAddCoverage = true;
    this.showSelectRaterType = false;
  }

  infoView(e) {
    console.log("info view  ==> ", e.detail);

    this.quoteAddCoverage = false;
    this.addQuoteInfo = false;
    this.infoViewPage = true;
    this.newQuoteId = e.detail;
  }

  cancelEvent() {
    console.log("cancel event ==> ");

    this.quoteAddCoverage = true;
    this.addQuoteInfo = false;
    this.infoViewPage = false;
  }

  // NEW FLOW: Handler for new component
  addQuoteInfoViewNew(e) {
    this.coverageDataNew = e.detail;

    console.log(
      "coverage data new map ==> ",
      JSON.parse(JSON.stringify(this.coverageDataNew))
    );

    this.quoteAddCoverage = false;
    this.addQuoteInfo = true;
    this.infoViewPage = false;
  }

  handleCancel() {
    console.log("handle event ==> ");

    // Close the quick action
    const closeEvent = new CustomEvent("close");
    this.dispatchEvent(closeEvent);
  }

  handleError(event) {
    const errorEvent = event;
    console.log("--- event --- ==> ", JSON.stringify(event));
    if (errorEvent.detail.showToastError == true) {
      const toastEvent = new ShowToastEvent({
        title: "Error",
        message: errorEvent.detail.showToastMessage[0],
        variant: "error"
      });
      this.dispatchEvent(toastEvent);
    }
  }
}
