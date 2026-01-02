import { LightningElement, api } from 'lwc';

export default class LightningFieldItem extends LightningElement {
    @api fieldType;
    @api fieldLabel;
    @api fieldApiName;
    @api pickListEntries;
    @api coverage;
    @api value;
    @api quoteCoverageLinkId;

    inputType;
    isNumber;
    isPercent;
    isTextArea;
    isDate;
    isPicklist;
    isText;
    isCheckbox;

    options = [];

    connectedCallback() {

        switch (this.fieldType) {

            case 'CURRENCY':
                this.inputType = 'number';
                this.isNumber = true;
                if (this.value == null)
                    this.value = 0;
            break;

            case 'PERCENT':
                this.inputType = 'number';
                this.isPercent = true;
                if (this.value == null)
                    this.value = 0.0
            break;

            case 'STRING':
                this.inputType = 'text';
                this.isText = true;
                if (this.value == null) 
                     this.value = '';       
            break;

            case 'TEXTAREA':
                this.inputType = 'text';
                this.isTextArea = true;
                if (this.value == null)
                     this.value = '';
            break;

            case 'DOUBLE':
                this.inputType = 'number';
                this.isDouble = true;
                if (this.value == null)
                    this.value = 0
            break;
            
            case 'PICKLIST':
                this.isPicklist = true;
                this.options = Object.keys(this.pickListEntries).map(key => {
                    return { label: key, value: this.pickListEntries[key] };
                });
                if (this.value == null)
                    this.value = this.options[0].value;
            break;
                
            case 'DATE':
                this.inputType = 'date';
                this.isDate = true;
                if (this.value == null) 
                    this.value = new Date();
            break;
            
            case 'BOOLEAN':
                this.isCheckbox = true;
                this.inputType = 'checkbox';
                if (this.value == null) 
                    this.value = false;
            break;

            default:
            break;
        }

    }

    handleCheck(event) {
        this.value = event.target.checked;
    }

    handleChange(event) {
        const inputValue = event.detail.value;
        this.value = inputValue;

        if (!inputValue && this.inputType == 'number') {
            this.value = 0;
        }
        if (!inputValue && this.inputType == 'checkbox') {
            console.log(this.value);
        }
    }

}