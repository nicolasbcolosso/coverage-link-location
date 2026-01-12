import { LightningElement, track, api } from "lwc";
import isScaleOpp from "@salesforce/apex/QuoteController.isScaleOpp";
import isLocationBasedPropertyEnabled from "@salesforce/apex/CoverageSelectionController.isLocationBasedPropertyEnabled";
import { ShowToastEvent } from "lightning/platformShowToastEvent";

export default class NewQuoteFromOpportunity extends LightningElement {
  @api recordId;
  @api newid;

  @api selectedRaterType;
  @api limitToQuote;

  isScale = false;
  quoteAddCoverage = false;
  showSelectRaterType = false;

  redirectQuote = false;
  addQuoteInfo = false;
  infoViewPage = false;

  newQuoteId;

  // NEW: Track if new property flow is enabled
  useNewPropertyFlow = false;
  @track coverageDataNew = null;

  async connectedCallback() {
    console.log("record id ==> " + this.recordId);

    try {
      // Check if location-based property is enabled org-wide
      this.useNewPropertyFlow = await isLocationBasedPropertyEnabled();

      // Check if Scale opportunity
      const oppIsScale = await isScaleOpp({ oppId: this.recordId });
      this.isScale = oppIsScale;
      this.quoteAddCoverage = !this.isScale;
      this.showSelectRaterType = this.isScale;

      console.log("state info ==> ", {
        useNewPropertyFlow: this.useNewPropertyFlow,
        isScale: this.isScale,
        quoteAddCoverage: this.quoteAddCoverage,
        showSelectRaterType: this.showSelectRaterType
      });
    } catch (error) {
      console.error("Error in connectedCallback ==> ", error);
      this.useNewPropertyFlow = false;
      this.quoteAddCoverage = true;
    }
  }

  raterTypeChangeHandler(event) {
    console.log("rater event.detail ==> ", event.detail);
    this.selectedRaterType = event.detail;
    this.quoteAddCoverage = true;
    this.showSelectRaterType = false;
  }

  handlePrevious() {
    console.log("previous ==> ", this.recordId);

    isScaleOpp({
      oppId: this.recordId
    }).then((oppIsScale) => {
      this.isScale = oppIsScale;
      this.quoteAddCoverage = !this.isScale;
      this.showSelectRaterType = this.isScale;
    });
  }

  nextView() {
    this.quoteAddCoverage = !this.isScale;
    this.addQuoteInfo = false;
    this.infoViewPage = false;
  }

  infoView(e) {
    this.quoteAddCoverage = false;
    this.addQuoteInfo = false;
    this.infoViewPage = true;
    this.newQuoteId = e.detail;
  }

  cancelEvent() {
    this.quoteAddCoverage = true;
    this.addQuoteInfo = false;
    this.infoViewPage = false;
  }

  itemreceived(e) {
    console.log("item received ==> ", e.detail);
  }

  // OLD FLOW: Handler for old component
  addQuoteInfoView(e) {
    this.limitToQuote = e.detail;

    // console.log("limits to quote ==> ", JSON.parse(e.detail));

    this.quoteAddCoverage = false;
    this.addQuoteInfo = true;
    this.infoViewPage = false;

    // console.log("state info ==> ", {
    //   useNewPropertyFlow: this.useNewPropertyFlow,
    //   isScale: this.isScale,
    //   quoteAddCoverage: this.quoteAddCoverage,
    //   showSelectRaterType: this.showSelectRaterType
    // });
  }

  // NEW FLOW: Handler for new component
  addQuoteInfoViewNew(e) {
    this.coverageDataNew = e.detail;

    console.log(
      "coverage map ==> ",
      JSON.parse(JSON.stringify(this.coverageDataNew))
    );

    this.quoteAddCoverage = false;
    this.addQuoteInfo = true;
    this.infoViewPage = false;

    console.log("state info ==> ", {
      useNewPropertyFlow: this.useNewPropertyFlow,
      isScale: this.isScale,
      quoteAddCoverage: this.quoteAddCoverage,
      showSelectRaterType: this.showSelectRaterType
    });
  }

  handleCancel() {
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

  handleReloadView() {
    // Reload the view after save
  }
}
